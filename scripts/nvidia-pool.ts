// Run inside the backend container. Secrets remain in environment.
import {closeDb} from "@aihot/backend/db";
import {probeNvidiaPool,poolOverview} from "@aihot/backend/providers/nvidia-pool";
try {
  if(process.argv.includes("--probe"))console.log(JSON.stringify(await probeNvidiaPool()));
  console.log(JSON.stringify(await poolOverview()));
}finally{await closeDb();}
