/** Small engine-neutral meshes for the two shapes absent from standard primitives. */
export function specialPieceGeometry(shape: 'hemisphere' | 'wedge'): {positions:number[];normals:number[];uvs:number[];indices:number[]} {
    const positions:number[]=[],normals:number[]=[],uvs:number[]=[],indices:number[]=[];
    const triangle=(a:number[],b:number[],c:number[],smooth=false)=>{
        const u=b.map((v,i)=>v-a[i]),v=c.map((q,i)=>q-a[i]);
        const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n);
        if(length<1e-10)return;
        for(const p of [a,b,c]){indices.push(positions.length/3);positions.push(...p);normals.push(...(smooth?p.map(q=>q*2):n.map(q=>q/length)));uvs.push(0,0);}
    };
    if(shape==='wedge'){
        const p=[[-.5,-.5,-.5],[.5,-.5,-.5],[.3,-.5,.5],[-.3,-.5,.5],[-.5,.5,-.5],[.5,.5,-.5],[.3,.5,.5],[-.3,.5,.5]];
        for(const f of [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]])triangle(p[f[0]],p[f[2]],p[f[1]]);
    }else{
        const point=(row:number,col:number)=>{const theta=row/8*Math.PI/2,phi=col/14*Math.PI*2;return [.5*Math.sin(theta)*Math.cos(phi),.5*Math.cos(theta),.5*Math.sin(theta)*Math.sin(phi)];};
        for(let row=0;row<8;row++)for(let col=0;col<14;col++){const a=point(row,col),b=point(row+1,col),c=point(row+1,col+1),d=point(row,col+1);triangle(a,d,b,true);triangle(b,d,c,true);}
        for(let col=0;col<14;col++)triangle([0,0,0],point(8,col),point(8,col+1));
    }
    return {positions,normals,uvs,indices};
}
