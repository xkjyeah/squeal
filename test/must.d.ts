//errorInfoHandler.d.ts
declare module "must" {
   var noTypeInfoYet: any; // any var name here really
   export = noTypeInfoYet;
}

interface LabScript {
  experiment: any,
  after: any,
  before: any,
  afterEach : any,
  test: any,
}

declare module "lab" {
  function script() : LabScript;
}
