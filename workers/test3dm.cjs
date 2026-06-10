const rhino3dm = require('rhino3dm');
async function run() {
  const rhino = await rhino3dm();
  const sphere = new rhino.Sphere([0,0,0], 5);
  const brep = rhino.Brep.createFromSphere(sphere);
  try {
    console.log("toJSON with empty:", brep.toJSON());
  } catch (e) {
    console.log("toJSON error:", e.message);
  }
  try {
    const opts = new rhino.SerializationOptions();
    console.log("toJSON with opts:", brep.toJSON(opts));
  } catch (e) {
    console.log("toJSON opts error:", e.message);
  }
}
run();
