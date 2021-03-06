/* Javascript Character class
 *
 * Copyright (C) 2010   Nicolas Bonnel (nicolas.bonnel@gmail.com)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

var xpInc = 2;

function Character(jsonFile,x,y,level){
	this['constitution'] = new Object();
	this['strength'] = new Object();
	this['intelligence'] = new Object();
	this['dexterity'] = new Object();
	this['melee'] = new Object();
	this['ranged'] = new Object();
	this['cast'] = new Object();
	this['run'] = new Object();
	this['block'] = new Object();
	this['enchant'] = new Object();
	this['hex'] = new Object();
	this['traps'] = new Object();
	this['stealth'] = new Object();
	this['slash'] = new Object();
	this['pierce'] = new Object();
	this['blunt'] = new Object();
	this['shield'] = new Object();
	this['fire'] = new Object();
	this['water'] = new Object();
	this['earth'] = new Object();
	this['air'] = new Object();
	this['light'] = new Object();
	this['dark'] = new Object();
	this['aoe'] = new Object();
	this['dot'] = new Object();
	for (skill in this){
		this[skill].level = 1;
		this[skill].xp = 0;
	}
	for (var i=0;i<jsonFile.aptitudes.length;i++)
		this[jsonFile.aptitudes[i].aptitude].level = eval(jsonFile.aptitudes[i].level);
	this.scale = eval(jsonFile.scale);
	this.modelName = jsonFile.modelName;
	this.x = x;
	this.y = y;
	this.z = world.getH(this.x,this.y);
	this.orient = Math.random()*360;
	this.maxHp = eval(jsonFile.hpspmp[0]);
	this.maxMp = eval(jsonFile.hpspmp[1]);
	this.maxSp = eval(jsonFile.hpspmp[2]);
	this.currentHp = this.maxHp;
	this.currentMp = this.maxMp;
	this.currentSp = this.maxSp;
	this.faction = jsonFile.faction;
	this.inventory = {};
	this.equipment = {};
	if(jsonFile.equipmentModif)
		for (var i=0;i<jsonFile.equipmentModif.length;i++)
			this.equipment[jsonFile.equipmentModif[i].type]= jsonFile.equipmentModif[i];

	if(models[this.modelName].collision.type=='circle')
		this.collision = new CircleCollision(this,models[this.modelName].collision.radius*this.scale);
	else if(models[this.modelName].collision.type=='rect')
		this.collision = new RectCollision(this,models[this.modelName].collision.collisionW*this.scale,models[this.modelName].collision.collisionH*this.scale);
	this.baseDamages = [];
	this.currentDamages = [];
	if (jsonFile.damages){
		for (var i=0;i<jsonFile.damages.length;i++){
			var dam = {};
			dam.value = eval(jsonFile.damages[i].value);
			dam.range = jsonFile.damages[i].range;
			dam.type = jsonFile.damages[i].damageType;
			dam.id = 'base';
			this.baseDamages.push(dam);
			this.currentDamages.push(dam);
			//debug(this.modelName +', level '+level+', dmg : '+this.baseDamages[i].value);
		}
		this.baseRange = jsonFile.range;
		this.currentRange = this.baseRange;
	}
	for(var i=0;i<jsonFile.gear.length;i++)
		if(jsonFile.gear[i].weapon){
			var it = new Item(items[jsonFile.gear[i].weapon],'normal',level);
			this.addEquipment(it);
			if (jsonFile.name=='Player'){
				this.inventory[it.id]=it;
				$('#leftgear div').eq(3).append(getIcon(it));
			}
		}else if(jsonFile.gear[i].shield){
			var it = new Item(items[jsonFile.gear[i].shield],'normal',level);
			this.addEquipment(it);
			if (jsonFile.name=='Player'){
				this.inventory[it.id]=it;
				$('#rightgear div').eq(3).append(getIcon(it));
			}
		}
	if (jsonFile.particle)
		world.particles.push(new ParticleEmiter(this,jsonFile.particle));
	this.properties = jsonFile;
	this.level = level;
	this.levelXP = 10;
	this.currentAction = new Action(this,skills['idle']);
	this.currentAction.isInterruptible = true;
	this.nextAction = this.currentAction;
	this.currentFrame = animations[this.modelName][this.currentAction.type].firstFrame;
	this.nextFrame = animations[this.modelName][this.currentAction.type].firstFrame+1;
	this.posFrame = 0.0;
}

Character.prototype.recover = function(hp,sp,mp){
	this.currentHp = Math.min(this.currentHp+hp,this.maxHp);
	this.currentSp = Math.min(this.currentSp+sp,this.maxSp);
	this.currentMp = Math.min(this.currentMp+mp,this.maxMp);
}

Character.prototype.update = function(elapsed){
	if (this.currentHp<this.maxHp && this.currentHp>0.0){
		var inc = (this.constitution.level+4)*(elapsed/25.0);
		this.currentHp += inc;
		this.currentHp = Math.min(this.currentHp,this.maxHp);
		this.xpAptitude('constitution',elapsed/3.0);
	}
	if (this.currentMp<this.maxMp && this.currentHp>0.0){
		var inc = (this.intelligence.level+4)*(elapsed/25.0);
		this.currentMp += inc;
		this.currentMp = Math.min(this.currentMp,this.maxMp);
		this.xpAptitude('intelligence',elapsed/3.0);
	}
	if (this.currentSp<this.maxSp && this.currentHp>0.0){
		var inc = (this.strength.level+4)*(elapsed/25.0);
		this.currentSp += inc;
		this.currentSp = Math.min(this.currentSp,this.maxSp);
		this.xpAptitude('strength',elapsed/3.0);
	}
	if(this.currentHp<=0.0){
		this.currentHp = 0;
		this.setAction(skills['die']);
		if(this != world.player)
			this.collision = null;
		this.circleHealth = null;
	}
	var h =  world.getH(this.x,this.y);
	this.z += (h-this.z)/4.0;
	if(this.ai)
		this.ai.process();
	if (this.currentAction.type.substring(0,4)=='walk')
		this.move(elapsed);
	for (var i=0;i<this.currentAction.lifeEffects.length;i++)
		if(!this.currentAction.lifeEffects[i].parts)
			this.currentAction.lifeEffects[i].process(elapsed);
}

Character.prototype.draw = function (){
	mvPushMatrix();
	mat4.translate(mvMatrix,[this.x, this.y,this.z]);
	if (models[this.modelName].orient)
		mat4.rotate(mvMatrix, degToRad(models[this.modelName].orient+this.orient), [0, 0, 1]);
	else
		mat4.rotate(mvMatrix, degToRad(this.orient), [0, 0, 1]);
	if(this.scale)
		mat4.scale(mvMatrix,[this.scale,this.scale,this.scale]);
	// TODO Childs collection
	for (equip in this.equipment)
		if (this.equipment[equip].bone && this.equipment[equip].item)
			this.equipment[equip].item.draw();
	if(this.circleHealth)
		this.circleHealth.draw();
	if(this.mesh)
		this.mesh.draw();
	else if(models[this.modelName].mesh)
		this.mesh = models[this.modelName].mesh;
	mvPopMatrix();	
}


Character.prototype.xpAptitude=function(skill,xp){
	if(this == world.player){
		this[skill].xp += xp;
		if(this[skill].xp>=this.levelXP){
			this[skill].xp -= this.levelXP;
			this[skill].level += 1;
			this.levelXP += xpInc;
			this.level += 0.1;
			document.getElementById(skill+'LVL').innerHTML = this[skill].level;
			document.getElementById('playerLevel').innerHTML = Math.floor(this.level);
			document.getElementById('playerLevelXP').innerHTML = this.levelXP;
			if(skill=='constitution')
				this.maxHp += 2;
			else if (skill=='strength')
				this.maxSp += 2;
			else if (skill=='intelligence')
				this.maxMp += 2;
		}
		document.getElementById(skill+'XP').innerHTML = Math.floor(this[skill].xp);
	}
}

Character.prototype.damage = function(dmgs){
	var damages = 0.0;
	for (var j=0;j<dmgs.length;j++){
		damages += dmgs[j].value;
	}
	this.currentHp -= damages;
	this.currentAction.isInterruptible = true;
	if(this.currentHp<=0.0){
		this.currentHp = 0;
		this.setAction(skills['die']);
		if(this != world.player)
			this.collision = null;
		this.circleHealth = null;
	}else
		this.setAction(skills['hit']);
	world.particles.push(new ParticleEmiter(this,'blood'));
	createNumber(this,Math.floor(damages));
}


Character.prototype.addEquipment = function(item){
	if (!this.equipment[item.type])
		this.equipment[item.type] = {};
	else if(this.equipment[item.type].item)
		this.removeEquipment(item.type);
	this.equipment[item.type].item = item;
	item.parentModif = this.equipment[item.type];
	if(item.type=='weapon'){
		for(var i=0;i<this.currentDamages.length;i++)
			if(this.currentDamages[i].id == 'base') {
				this.currentDamages.splice(i, 1);
			}
		var dam = {};
		dam.value = item.damages;
		dam.range = item.damageRange;
		dam.type = item.damageType;
		dam.id = item.id;
		this.currentDamages.push(dam);
		this.currentRange = item.range;
	}
	for (var x in item.powers){
		if (item.powers[x].effect.type == 'damage'){
			var dam = {};
			dam.value = item.powers[x].effect.value;
			dam.range = 0;
			dam.id = item.id;
			dam.type =  item.powers[x].effect.damageType;
			this.currentDamages.push(dam);
		}else if (item.powers[x].effect.type == 'bonus'){
			if (item.powers[x].effect.aptitude == 'hp')
				this.maxHp += item.powers[x].effect.value;
			else if (item.powers[x].effect.aptitude == 'sp')
				this.maxSp += item.powers[x].effect.value;
			else if (item.powers[x].effect.aptitude == 'mp')
				this.maxMp += item.powers[x].effect.value;
		}
	}
}

Character.prototype.removeEquipment = function(type){
	var item = this.equipment[type].item;
	for (var x in item.powers){
		if (item.powers[x].effect.type == 'damage'){
			for(var i=0;i<this.currentDamages.length;i++)
				if(this.currentDamages[i].id == item.id) {
					this.currentDamages.splice(i, 1);
					break;
				}
		}else if (item.powers[x].effect.type == 'bonus'){
			if (item.powers[x].effect.aptitude == 'hp'){
				this.maxHp -= item.powers[x].effect.value;
				this.currentHp = Math.min(this.currentHp,this.maxHp);
			}else if (item.powers[x].effect.aptitude == 'sp'){
				this.maxSp -= item.powers[x].effect.value;
				this.currentSp = Math.min(this.currentSp,this.maxSp);
			}else if (item.powers[x].effect.aptitude == 'mp'){
				this.maxMp -= item.powers[x].effect.value;
				this.currentMp = Math.min(this.currentMp,this.maxMp);
			}
		}
	}
	this.equipment[type].item = null;
	if(type=='weapon'){
		for(var i=0;i<this.currentDamages.length;i++)
			if(this.currentDamages[i].id == item.id) {
				this.currentDamages.splice(i, 1);
			}
		for(var i=0;i<this.baseDamages.length;i++)
			this.currentDamages.push(this.baseDamages[i]);
		this.currentRange = this.baseRange;
	}
}


Character.prototype.setAction = function(skill){
	if(this.nextAction.type != skill.action && this.nextAction.type != 'die' && this.nextAction.type != 'opened' && this.nextAction.type != 'disapear' && this.nextAction.type != 'hit'){
		setAptitudeVars(this);
		//debug(this.nextAction.type+','+skill.action);
		if(eval(skill.cost[1])<=this.currentSp && eval(skill.cost[2])<=this.currentMp)		
			this.nextAction = new Action(this,skill);
		if(this.nextAction.type=='idle' || this.nextAction.type== 'walkF'|| this.nextAction.type== 'walkB')
			this.nextAction.isInterruptible = true;
	}
}

Character.prototype.move= function(elapsed){
	if (!this.moveAngle)
		this.moveAngle = 0;
	var theta = (models[this.modelName].orient+this.orient+this.moveAngle)*Math.PI/180.0;
	var dx = this.x+this.speed*Math.sin(theta)*elapsed;
	var dy = this.y-this.speed*Math.cos(theta)*elapsed;
	var objs = this.getCollisions(dx,dy);
	var moveOk = true;
	var moveOk2 = true;
	for (var i=0;i<objs.length && moveOk;i++){
		if(!objs[i].status || objs[i].status.currentHp>0){
			moveOk = false;
			if (objs[i].collision.tangent){
				var tangent = objs[i].collision.tangent(this.x,this.y);
				var s = tangent.x*(dx-this.x)+tangent.y*(dy-this.y);
				if (s<0){
					tangent.x = -tangent.x;
					tangent.y = -tangent.y;
					s = -s;
				}
				dx = this.x + tangent.x*s;
				dy = this.y + tangent.y*s;
				var objs2 = this.getCollisions(dx,dy);
				for (var j=0;j<objs2.length && moveOk2;j++)
					moveOk2 = moveOk2 && (objs2[j].status && objs2[j].status.currentHp<=0);
				if (moveOk2){
					if(this.ai){
						var xInd = Math.floor(this.x/(world.tileSize*world.gridSize));
						var yInd = Math.floor(this.y/(world.tileSize*world.gridSize));
						var dxInd = Math.floor(dx/(world.tileSize*world.gridSize));
						var dyInd = Math.floor(dy/(world.tileSize*world.gridSize));
						if(xInd != dxInd || yInd != dyInd){
							world.removeObjectFromGrid(this);
							world.grid[dxInd][dyInd].push(this);
						}
					}
					this.x += tangent.x*s;
					this.y += tangent.y*s;
				}
			}
		}
	}
	if(moveOk && moveOk2 && dx && dy){
		if(this.ai){
			var xInd = Math.floor(this.x/(world.tileSize*world.gridSize));
			var yInd = Math.floor(this.y/(world.tileSize*world.gridSize));
			var dxInd = Math.floor(dx/(world.tileSize*world.gridSize));
			var dyInd = Math.floor(dy/(world.tileSize*world.gridSize));
			if(xInd != dxInd || yInd != dyInd){
				world.removeObjectFromGrid(this);
				world.grid[dxInd][dyInd].push(this);
			}
		}
		this.x = dx;
		this.y = dy;
	}
}

Character.prototype.animate = function(elapsed){
	this.update(elapsed);
	if (animations[this.modelName][this.currentAction.type] && this.currentAction.type != 'disapear')
		this.posFrame += animations[this.modelName][this.currentAction.type].speed*elapsed;
	while(this.posFrame>=1.0){
		this.posFrame -= 1.0;
		this.currentFrame = this.nextFrame;
		if(this.currentFrame >= animations[this.modelName][this.currentAction.type].lastFrame){
			for (var i=0;i<this.currentAction.finishEffects.length;i++)
				this.currentAction.finishEffects[i].process(elapsed);
			if(this.currentAction.aptitudes)
				for (var i=0;i<this.currentAction.aptitudes.length;i++)
					this.xpAptitude(this.currentAction.aptitudes[i],1);
			if (this.currentAction.type =='die'){
				this.nextAction = new Action(this,skills['disapear']);
				if(this != world.player && rand()<0.5){
					var drop = loot(this.level,rand());
					drop.x = this.x;
					drop.y = this.y;
					drop.z = this.z;
					world.addObj(drop);
				}
			}else if(this.currentAction.type =='open'){
				this.nextAction = new Action(this,skills['opened']);
				var drop = loot(this.level+1,rand()/5.0);
				//debug(this.level+1);
				var theta = (models[this.modelName].orient+this.orient)*Math.PI/180.0;
				drop.x = this.x+Math.sin(theta);
				drop.y = this.y-Math.cos(theta);
				drop.z = this.z;
				world.addObj(drop);
			}
			else if (this.currentAction.type =='hit'){
				this.nextAction = new Action(this,skills['idle']);
				this.nextAction.isInterruptible = true;
			}
			for (var i=0;i<this.currentAction.lifeEffects.length;i++)
				this.currentAction.lifeEffects[i].finalize();
			this.currentAction = this.nextAction;
			for (var i=0;i<this.currentAction.lifeEffects.length;i++)
				if(this.currentAction.lifeEffects[i].alive)
					world.particles.push(this.currentAction.lifeEffects[i]);
			this.setAction(skills['idle']);
			this.currentHp -= this.currentAction.hpCost;
			this.currentSp -= this.currentAction.spCost;
			this.currentMp -= this.currentAction.mpCost;
			this.nextFrame = animations[this.modelName][this.currentAction.type].firstFrame;
		}else if(this.currentAction.isInterruptible && this.currentAction.type != this.nextAction.type){
			for (var i=0;i<this.currentAction.lifeEffects.length;i++)
				this.currentAction.lifeEffects[i].finalize();
			this.currentAction = this.nextAction;
			for (var i=0;i<this.currentAction.lifeEffects.length;i++)
				if(this.currentAction.lifeEffects[i].alive)
					world.particles.push(this.currentAction.lifeEffects[i]);
			this.setAction(skills['idle']);
			this.currentHp -= this.currentAction.hpCost;
			this.currentSp -= this.currentAction.spCost;
			this.currentMp -= this.currentAction.mpCost;
			this.nextFrame = animations[this.modelName][this.currentAction.type].firstFrame;	
		}else
			this.nextFrame += 1;
	}
	if (this.currentAction.type == 'walk')
		this.setAction(skills['idle']);

	if(this.boneAnim){
		var boneOrient = [];
		var bonePos = [];
		var p1 = this.boneAnim[this.currentFrame].bonePos;
		var p2 = this.boneAnim[this.nextFrame].bonePos;
		var o1 = this.boneAnim[this.currentFrame].boneOrient;
		var o2 = this.boneAnim[this.nextFrame].boneOrient;
		for (var i=0;i<this.mesh.bones.length;i++){
			for (var j=0;j<3;j++)
				bonePos.push(p1[i*3+j]*(1-this.posFrame)+p2[i*3+j]*this.posFrame);
			var q1 = new Quat(o1[i*4],o1[i*4+1],o1[i*4+2]);
			q1.w = o1[i*4+3];
			var q2 = new Quat(o2[i*4],o2[i*4+1],o2[i*4+2]);
			q2.w = o2[i*4+3];
			var q3 = q1.slerp(q2,this.posFrame);
			boneOrient.push(q3.x);
			boneOrient.push(q3.y);
			boneOrient.push(q3.z);
			boneOrient.push(q3.w);
			for (equip in this.equipment)
				if (this.equipment[equip].bone && this.equipment[equip].item && this.equipment[equip].bone== i){
					this.equipment[equip].item.axisAngle = q3.axisAngle();
					this.equipment[equip].item.x = bonePos[3*this.equipment[equip].bone];
					this.equipment[equip].item.y = bonePos[3*this.equipment[equip].bone+1];
					this.equipment[equip].item.z = bonePos[3*this.equipment[equip].bone+2];
				}
		}
		gl.useProgram(this.mesh.shaderProgram);
		gl.uniform4fv(this.mesh.shaderProgram.jointOrient,boneOrient);
		gl.uniform3fv(this.mesh.shaderProgram.jointPos,bonePos);
	}else if(this.mesh && animations[this.modelName] && animations[this.modelName].anim)
		this.boneAnim = animations[this.modelName].anim;
	//else
		//debug(this.modelName+', '+animations[this.modelName].anim);
}


Character.prototype.bindPose = function (){
	var boneOrient = [];
	var bonePos = [];
	for (var i=0;i<this.mesh.bones.length;i++){
		boneOrient.push(this.mesh.bones[i].orient.x);
		boneOrient.push(this.mesh.bones[i].orient.y);
		boneOrient.push(this.mesh.bones[i].orient.z);
		boneOrient.push(this.mesh.bones[i].orient.w);
		bonePos.push(this.mesh.bones[i].x);
		bonePos.push(this.mesh.bones[i].y);
		bonePos.push(this.mesh.bones[i].z);
	}
	if(this.weapon){
		var q3 = new Quat(boneOrient[4*this.weaponBone],boneOrient[4*this.weaponBone+1],boneOrient[4*this.weaponBone+2]);
		q3.w = boneOrient[4*this.weaponBone+3];
		this.weapon.axisAngle = q3.axisAngle();
		var cq = q3.rot(this.weapon.offx,this.weapon.offy,this.weapon.offz);
		this.weapon.x = bonePos[3*this.weaponBone];
		this.weapon.y = bonePos[3*this.weaponBone+1];
		this.weapon.z = bonePos[3*this.weaponBone+2];
	}	
	gl.useProgram(this.mesh.shaderProgram);
	gl.uniform4fv(this.mesh.shaderProgram.jointOrient,boneOrient);
	gl.uniform3fv(this.mesh.shaderProgram.jointPos,bonePos);
}

Character.prototype.getCollisions = function(x,y){
	var objs = world.getObjNear(x,y,1);
	var colList = [];
	for (var i=0;i<objs.length;i++)
		if (objs[i] != this && objs[i].collision && this.collision && objs[i].collision.collide(x,y,this.collision.radius))
			colList.push(objs[i]);
	return colList;
}
