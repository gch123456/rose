import {voxelizeTriangles} from '../studio-voxelizer.js';
import {makeLevelFromCells} from '../../../assets/scripts/color-clear/ColorClearLevels.ts';
self.onmessage=({data})=>{try{const result=voxelizeTriangles(data.triangles,data.options);const level=makeLevelFromCells(result.cells,data.levelOptions);self.postMessage({ok:true,...result,level});}catch(error){self.postMessage({ok:false,error:error.message});}};
