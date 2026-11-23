// Walkable cells are baked from the Blender meshes, including impassable artwork.
export function terrain(data) {
  const {x0,y0,step,nx,ny} = data;
  const bits = Uint8Array.from(atob(data.cells), c => c.charCodeAt(0));
  const index = (x,z) => {
    const i = Math.round((x-x0)/step), j = Math.round((-z-y0)/step);
    return i>=0 && i<nx && j>=0 && j<ny ? j*nx+i : -1;
  };
  const open = n => n>=0 && n<nx*ny && Boolean(bits[n>>3] & (1<<(n&7)));
  const point = n => ({x:x0+(n%nx)*step,z:-(y0+Math.floor(n/nx)*step)});
  function free(x,z) {
    const margin=.16;
    return [[0,0],[margin,0],[-margin,0],[0,margin],[0,-margin]].every(([a,b])=>open(index(x+a,z+b)));
  }
  function path(from,to) {
    const start=index(from.x,from.z), end=index(to.x,to.z);
    if (!open(start)||!free(to.x,to.z)) return [];
    const parents=new Int32Array(nx*ny).fill(-1), queue=new Int32Array(nx*ny);
    let read=0, written=1;
    queue[0]=start; parents[start]=start;
    while(read<written && parents[end]===-1) {
      const last=queue[read++];
      for(const d of [1,-1,nx,-nx]) {
        const next=last+d;
        if(!open(next)||parents[next]!==-1) continue;
        const p=point(next);
        if(!free(p.x,p.z)) continue;
        parents[next]=last;queue[written++]=next;
      }
    }
    if(parents[end]===-1) return [];
    const ordered=[];
    for(let n=end;n!==start;n=parents[n]) ordered.push(point(n));
    ordered.reverse();
    // Skip grid corners only while each point on the direct segment still clears the walls.
    function visible(a,b) {
      const parts=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/(.45*step));
      for(let i=1;i<=parts;i++) if(!free(a.x+(b.x-a.x)*i/parts,a.z+(b.z-a.z)*i/parts)) return false;
      return true;
    }
    const route=[];let anchor=from;
    for(let i=0;i<ordered.length;) {
      let next=i;
      while(next+1<ordered.length && next-i<32 && visible(anchor,ordered[next+1])) next++;
      anchor=ordered[next];route.push(anchor);i=next+1;
    }
    return route;
  }
  return {free,path};
}
