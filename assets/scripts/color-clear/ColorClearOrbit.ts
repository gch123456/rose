import type {ColorClearGame} from './ColorClearGame';
/** Presentation-only motion: rules remain deterministic when no input is supplied. */
export class ModelOrbit {
 private autoEnabled=true;
 private held=false;
 private resumeDelay=0;
 private vx=0;
 private vy=0;
 get enabled():boolean{return this.autoEnabled;}
 get automatic():boolean{return this.autoEnabled&&!this.held&&this.resumeDelay<=0;}
 reset(automatic=true):void{this.autoEnabled=automatic;this.held=false;this.resumeDelay=0;this.vx=0;this.vy=0;}
 stop():void{this.reset(false);}
 beginDrag():void{this.held=true;this.resumeDelay=1;this.vx=0;this.vy=0;}
 release(cancelled:boolean,idleSeconds:number):void{
  this.held=false;this.resumeDelay=1;
  if(this.autoEnabled||cancelled||idleSeconds>.09){this.vx=0;this.vy=0;}
 }
 drag(model:ColorClearGame,dx:number,dy:number,seconds:number):void{
  this.held=true;this.resumeDelay=1;
  const yaw=dx*.012,pitch=-dy*.010;model.rotate(yaw,pitch);
  this.vx=Math.max(-1.8,Math.min(1.8,yaw/Math.max(.008,seconds)));
  this.vy=Math.max(-1.2,Math.min(1.2,pitch/Math.max(.008,seconds)));
 }
 step(model:ColorClearGame,dt:number,dragging=false):void{
  if(model.phase!=='playing'||!Number.isFinite(dt)||dt<=0||dragging||this.held)return;
  if(this.autoEnabled){
   // The idle deadline uses wall time; motion remains capped after slow frames.
   const waiting=this.resumeDelay;
   this.resumeDelay=Math.max(0,waiting-dt);
   if(this.resumeDelay<1e-9)this.resumeDelay=0;
   const moving=Math.max(0,dt-waiting);
   if(this.automatic&&moving>1e-9)model.rotate(8*Math.PI/180*Math.min(.25,moving));
  }else{
   const step=Math.min(.25,dt);
   model.rotate(this.vx*step,this.vy*step);
   this.vx*=Math.exp(-18*step);this.vy*=Math.exp(-18*step);
   if(Math.abs(this.vx)<.015)this.vx=0;if(Math.abs(this.vy)<.015)this.vy=0;
  }
 }
}
