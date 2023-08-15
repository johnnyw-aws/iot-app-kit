// @ts-nocheck

import * as fs from 'fs';
import * as path from 'path';
// import { createWriteStream, WriteStream } from 'fs';
import {tmdt_config_file} from "../commands/init";
import {get} from "./revit_request"
// const axios = require('axios');
import { setTimeout } from 'timers/promises';
import {run} from "./forge-convert-utils-run";
import {run_gltf_pipeline} from "./gltf-pipeline-run";
import {EmptyNode} from "./scene_utils/node/empty_node";
// import {ModelType, NavLink, Rule, Statement, Target} from "./scene_utils/utils/types";
import {ModelRefNode} from "./scene_utils/node/model.ts/model_ref";
// import {
//   assetToModelRef,
//   parseCsv,
//   processMixerTransform
// } from "./scene_utils/samples/cookie_factory_sample/sample_utils";
// import {TagNode} from "./scene_utils/node/tag/tag";
// import {DataBinding} from "./scene_utils/node/tag/data_binding";
// import {MotionIndicatorNode} from "./scene_utils/node/indicator.ts/motion_indicator";
// import {ModelShader} from "./scene_utils/components/model_shader_component";
// import {IotTwinMakerScene} from "./scene_utils/scene/iot_twin_maker_scene";
import {IotTwinMakerSceneImpl} from "./scene_utils/scene/iot_twin_maker_scene_impl";
// import {SceneFactoryImpl} from "./scene_utils/factory/scene_factory_impl";
import {Serializer} from "./scene_utils/utils/serializer";
import {withTrailingSlash} from "./scene_utils/utils/file_utils";
import {extract_revit_properties} from "./revit-property-server";

const { ModelDerivativeClient, DataManagementClient, AuthenticationClient } = require('autodesk-forge-tools');

interface DataType {
  nestedType?: {
    type: string;
  };
  type: string;
}

interface Definition {
  dataType: DataType;
}

// interface MapValue {
//   [key: string]: {
//     stringValue: string;
//   };
// }

interface Value {
  stringValue?: string;
  integerValue?: number;
  mapValue?: any; //MapValue;
}

interface Property {
  definition: Definition;
  value: Value;
}

interface MetadataObject {
  componentTypeId: string;
  properties: {
    elementId?: Property;
    externalId: Property;
    nodeId: Property;
  };
}

interface CategoryObject {
  componentTypeId: string;
  properties:{
    category: Property;
    rc?: Property;
    rfn?: Property;
    rft?: Property;
  };
}

interface Properties {
  properties: Property;
  propertyGroupName: Property;
}

interface PropertiesObject {
  componentTypeId: string;
  properties: Properties;
}

function createMetadataObject(elementIdValue: string, externalIdValue: string, nodeIdValue: number): MetadataObject {
  let metadataObj : MetadataObject = {
    componentTypeId: "com.example.smartbuilding.revit.metadata",
    properties: {
      externalId: {
        definition: {
          dataType: {
            type: "STRING"
          }
        },
        value: {
          stringValue: externalIdValue
        }
      },
      nodeId: {
        definition: {
          dataType: {
            type: "INTEGER"
          }
        },
        value: {
          integerValue: nodeIdValue
        }
      }
    }
  }

  if(elementIdValue != null){
    metadataObj.properties.elementId = {
      definition: {
        dataType: {
          type: "STRING"
        }
      },
      value: {
        stringValue: elementIdValue
      }
    };
  }
  return metadataObj;
}

// let metadataobj1 = createMetadataObject('', "external id abcdefg", 111);
// let metadataobj2 = createMetadataObject("12345", "external id 42", 42);

function createCategoryObj(categoryValue: string, rcValue: string, rfnValue: string, rftValue: string): CategoryObject{
  let categoryObj : CategoryObject= {
    componentTypeId: "com.example.smartbuilding.revit.metadata",
    properties: {
      category: {
        definition: {
          dataType: {
            type: "STRING"
          }
        },
        value: {
          stringValue: categoryValue
        }
      }
    }
  }

  if(rcValue != null){
    categoryObj.properties.rc = {
      definition: {
        dataType: {
          type: "STRING"
        }
      },
      value: {
        stringValue: rcValue
      }
    };
  }

  if(rfnValue != null){
    categoryObj.properties.rfn = {
      definition: {
        dataType: {
          type: "STRING"
        }
      },
      value: {
        stringValue: rfnValue
      }
    };
  }

  if(rftValue != null){
    categoryObj.properties.rft = {
      definition: {
        dataType: {
          type: "STRING"
        }
      },
      value: {
        stringValue: rftValue
      }
    };
  }

  return categoryObj;
}

function createPropertiesObj(mapValues: any /*MapValue*/, propertyGroupName: string): PropertiesObject{
  let propertiesObj: PropertiesObject = {
    componentTypeId: "com.example.smartbuilding.revit.properties",
    properties: {
      properties:{
        definition:{
          dataType:{
            nestedType:{
              type: "STRING"
            },
            type: "MAP"
          }
        },
        value:{
          mapValue: mapValues
        }
      },
      propertyGroupName: {
        definition:{
          dataType:{
            type:"STRING"
          }
        },
        value:{
          stringValue: propertyGroupName
        }
      }
    }
  }

  return propertiesObj;
}

function normalizeEntityName(entityName: string): string {
  return entityName.trim()
    .replace(/\[/g, "")
    .replace(/\]/g, "")
    .replace(/"/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .replace(/</g, "")
    .replace(/>/g, "")
    .replace(/\{/g, "")
    .replace(/\}/g, "")
    .replace(/!/g, "")
    .replace(/\?/g, "")
    .replace(/&/g, "_")
    .replace(/,/g, " ")
    .replace(/\//g, "_")
    .replace(/\\/g, "_");
}

// function normalizeSystemName(systemName: string): string {
//   return systemName.trim()
//     .replace(/ /g, "_")
//     .replace(/\{/g, "")
//     .replace(/\}/g, "")
//     .replace(/\[/g, "")
//     .replace(/\]/g, "")
//     .replace(/\(/g, "")
//     .replace(/\)/g, "")
//     .replace(/\//g, "-")
//     .replace(/\\/g, "-");
// }
//
function normalizeIdentityData(identityData: string): string {
  var result =  identityData.trim()
    .replace(/\r/g, " ")
    .replace(/\n/g, " "); // TODO verify ok: replacing newlines with spaces seems cleaner
  if (result.length == 0) {
    return "''"; // TODO verify if ok: twinmaker doesnt allow "" nor " " as a stringValue, for nested map type, this is injecting a single-quoted string to allow it through...
  } else {
    return result;
  }
} // FIXME these should be used?

function normalizeComponentName(name: string): string {
  if (name.includes("_") || name.includes("-") || name.includes("/")) {
    return name.trim()
      .replace(/ /g, "")
      .replace(/-/g, "_")
      .replace(/\//g, "_");
  }
  return name.trim()
    .replace(/ /g, "_")
    .replace(/\//g, "_");
}

async function initEntitiesFromRevitJson(tmdt_config: tmdt_config_file, outDir: string, revitJsonFilePath: string) {
  console.log(revitJsonFilePath);

  const revitEntities: Map<number, any> = new Map();

// const jsonPath = path.resolve(__dirname, '../rme.json');
//   const jsonPath = path.resolve(__dirname, 'snowdon.json');
  const jsonPath = path.resolve(revitJsonFilePath);
  const allCategoriesList = [
    "Document",
    "Family Type"
  ];

  // const mepCategoriesList = [
  //   "Air Systems",
  //   "Air Terminals",
  //   "Duct Fittings",
  //   "Duct Systems",
  //   "Ducts",
  //   "Electrical Equipment",
  //   "HVAC Zones",
  //   "Mechanical Equipment"
  // ];

  const allowedRevitCategories = [
    "Abutments",
    "Air Systems",
    "Air Terminals",
    "Analysis Display Style",
    "Analysis Results",
    "Areas",
    "Audio Visual Devices",
    "Bearings",
    "Bridge Cables",
    "Bridge Decks",
    "Bridge Framing",
    "Cable Tray Fittings",
    "Cable Tray Runs",
    "Cable Trays",
    "Casework",
    "Ceilings",
    "Columns",
    "Communication Devices",
    "Conduit Fittings",
    "Conduit Runs",
    "Conduits",
    "Coordination Model",
    "Curtain Grids",
    "Curtain Panels",
    "Curtain Systems",
    "Curtain Wall Mullions",
    "Data Devices",
    "Detail Items",
    "Doors",
    "Duct Accessories",
    "Duct Fittings",
    "Duct Insulations",
    "Duct Linings",
    "Duct Placeholders",
    "Duct Systems",
    "Ducts",
    "Electrical Circuits",
    "Electrical Equipment",
    "Electrical Fixtures",
    "Electrical Spare/Space Circuits",
    "Entourage",
    "Expansion Joints",
    "Filled region",
    "Fire Alarm Devices",
    "Fire Protection",
    "Flex Ducts",
    "Flex Pipes",
    "Floors",
    "Food Service Equipment",
    "Furniture",
    "Furniture Systems",
    "Generic Models",
    "Hardscape",
    "HVAC Zones",
    "Imports in Families",
    "Lighting Devices",
    "Lighting Fixtures",
    // "Lines",
    "Masking Region",
    "Mass",
    "Materials",
    "Mechanical Equipment",
    "Mechanical Equipment Sets",
    "Medical Equipment",
    "MEP Fabrication Containment",
    "MEP Fabrication Ductwork",
    "MEP Fabrication Hangers",
    "MEP Fabrication Pipework",
    "Nurse Call Devices",
    "Parking",
    "Parts",
    "Piers",
    "Pipe Accessories",
    "Pipe Fittings",
    "Pipe Insulations",
    "Pipe Placeholders",
    "Pipe Segments",
    "Pipes",
    "Piping Systems",
    "Planting",
    "Plumbing Fixtures",
    "Point Clouds",
    "Project Information",
    "Railings",
    "Ramps",
    "Raster Images",
    "Rebar Shape",
    "Roads",
    "Roofs",
    "Rooms",
    "Routing Preferences",
    "RVT Links",
    "Security Devices",
    "Shaft Openings",
    "Sheets",
    "Signage",
    "Site",
    "Spaces",
    "Specialty Equipment",
    "Sprinklers",
    "Stairs",
    "Structural Area Reinforcement",
    "Structural Beam Systems",
    "Structural Columns",
    "Structural Connections",
    "Structural Fabric Areas",
    "Structural Fabric Reinforcement",
    "Structural Foundations",
    "Structural Framing",
    "Structural Path Reinforcement",
    "Structural Rebar",
    "Structural Rebar Couplers",
    "Structural Stiffeners",
    "Structural Tendons",
    "Structural Trusses",
    "Switch System",
    "Telephone Devices",
    "Temporary Structures",
    "Topography",
    "Vertical Circulation",
    "Vibration Management",
    "Walls",
    "Water Loops",
    "Windows",
    "Wires",
    "Zone Equipment"
  ];



  // const CategoryComponentType = {
  //   "componentTypeId": "com.example.smartbuilding.revit.category",
  //   "description": "Stores category metadata from revit file",
  //   "isSingleton": false,
  //   "propertyDefinitions": {
  //     "category": {
  //       "dataType": {
  //         "type": "STRING"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     },
  //     "rc": {
  //       "dataType": {
  //         "type": "STRING"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     },
  //     "rfn": {
  //       "dataType": {
  //         "type": "STRING"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     },
  //     "rft": {
  //       "dataType": {
  //         "type": "STRING"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     }
  //   }
  // };

  // const MetadataComponentType = {
  //   "componentTypeId": "com.example.smartbuilding.revit.metadata",
  //   "description": "Stores identifiers metadata from revit file",
  //   "isSingleton": false,
  //   "propertyDefinitions": {
  //     "elementId": {
  //       "dataType": {
  //         "type": "STRING"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     },
  //     "externalId": {
  //       "dataType": {
  //         "type": "STRING"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     },
  //     "nodeId": {
  //       "dataType": {
  //         "type": "INTEGER"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     }
  //   }
  // };

  // const PropertiesComponentType = {
  //   "componentTypeId": "com.example.smartbuilding.revit.properties",
  //   "description": "Stores single group of properties from revit file",
  //   "isSingleton": false,
  //   "propertyDefinitions": {
  //     "properties": {
  //       "dataType": {
  //         "nestedType": {
  //           "type": "STRING"
  //         },
  //         "type": "MAP"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     },
  //     "propertyGroupName": {
  //       "dataType": {
  //         "type": "STRING"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     }
  //   }
  // };

  // fs.writeFile('categorycomponenttype.json', JSON.stringify(CategoryComponentType, null, 2), (err) => {
  //   if (err) throw err;
  //   console.log('Data written to file');
  // });

  // let testMapValues: MapValue = {}
  // testMapValues["Insulation Thickness"] = {stringValue: "0.01 autodesk.unit.unit:meter"}
  // testMapValues["Insulation Type"] = {stringValue:"\"\""}
  // testMapValues["Overall Size"] = {stringValue:"42 mmx 475"}
  // let testProperties = createPropertiesObj(testMapValues, "Insulation")
  // fs.writeFile('properties.json', JSON.stringify(testProperties, null, 2), (err) => {
  //   if (err) throw err;
  //   console.log('testProperties obj written to ');
  // });
  //
  // let testCategoryObj = createCategoryObj("Revit Family Type", "Electrical Equipment", "M_Lighting and Appliance Panelboard", "125 A")
  // fs.writeFile("categorytest.json", JSON.stringify(testCategoryObj, null, 2), (err) => {
  //   if (err) throw err;
  //   console.log('test category obj written to ');
  // });

  // fs.writeFile('metadataentity1.json', JSON.stringify(metadataobj1, null, 2), (err) => {
  //   if (err) throw err;
  //   console.log('metadata obj written to ');
  // });
  //
  // fs.writeFile('metadataentity2.json', JSON.stringify(metadataobj2, null, 2), (err) => {
  //   if (err) throw err;
  //   console.log('metadata obj written to ');
  // });

  const revitObject = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const jsonRevitEntities = revitObject.data.collection;
  console.log(`collection of the data child has size of : ${jsonRevitEntities.length}`);

  jsonRevitEntities.filter((element: any) =>
    (element.properties.__category__.Category &&
      (allowedRevitCategories.some(str => element.properties.__category__.Category.includes(str)) ||
        allCategoriesList.some(str => element.properties.__category__.Category.includes(str)))) ||
    (element.properties.__category__._RC&&
      (allowedRevitCategories.some(str => element.properties.__category__._RC.includes(str)) ||
        allCategoriesList.some(str => element.properties.__category__._RC.includes(str))))
  )
    .map((element: any) => revitEntities.set(element.objectid, element));
  console.log(`total count of revit entities is: ${revitEntities.size}`);

  // Write as entities

  const entities : any[] = [];

  // let entitiesStream: WriteStream = createWriteStream('/tmp/entitiesRevit.json');
  //
  // entitiesStream.on('error', (err: Error) => {
  //   console.error(`An error occurred writing entities.json: ${err.message}`);
  // });
  //
  //
  // try {
  //   entitiesStream.write("[\n")
  //   let entityIndex = 0;
    revitEntities.forEach((value, key) => {

      var entity : any = {};

      // FIXME - for testing just get root ones
      if (!value.parents[0]) {


        // if (entityIndex > 0) {
        //   entitiesStream.write(",\n")
        // }
        // entitiesStream.write("{\n")
        // entitiesStream.write("\"components\":{\n")

        entity['components'] = {}

        //Create and Write Category component
        let categoryValue = value.properties.__category__.Category
        let rcValue = value.properties.__category__._RC
        let rfhValue = value.properties.__category__._RFN
        let rftValue = value.properties.__category__._RFT
        let categoryObj = createCategoryObj(categoryValue, rcValue, rfhValue, rftValue)

        entity['components']['CATEGORY'] = categoryObj

        // entitiesStream.write("\"CATEGORY\":")
        // entitiesStream.write(JSON.stringify(categoryObj, null, 2))
        // entitiesStream.write(",\n")

        //Create and Write metadata component
        let elementIdValue = value.properties.__revit__?.ElementId
        let externalIdValue = value.externalId
        let nodeIdValue = value.objectid
        let metadataObj = createMetadataObject(elementIdValue, externalIdValue, nodeIdValue)

        entity['components']['METADATA'] = metadataObj

        // entitiesStream.write("\"METADATA\":")
        // entitiesStream.write(JSON.stringify(metadataObj, null, 2))
        // entitiesStream.write(",\n")

        //create and write all properties components
        // let propertyIndex = 0
        for (let prop in value.properties) {
          if (!prop.startsWith("__") && value.properties.hasOwnProperty(prop)) {
            // if (propertyIndex > 0) {
            //   entitiesStream.write(",\n")
            // }
            // entitiesStream.write(`\"${normalizeComponentName(prop)}\" : `)

            var mapValue : any = {};
            for (let sub_prop_key in value.properties[prop]) {
              mapValue[sub_prop_key] = {
                stringValue: normalizeIdentityData(value.properties[prop][sub_prop_key]) // TODO naming? why is this identity data in original scripts?
              }
            }

            let propertyMapValue: any = mapValue // MapValue = value.properties[prop]
            let propertyObj = createPropertiesObj(propertyMapValue, prop)
            entity['components'][`${normalizeComponentName(prop)}`] = propertyObj
            // entitiesStream.write(JSON.stringify(propertyObj, null, 2))
            // propertyIndex++
          }

        }

        //Close components section of entity
        // entitiesStream.write("},\n")

        //write top level entity properties: description, entityId, entityName, parententityId
        let description = `Generated entity for ${key}`
        let entityIdValue = value.externalId
        let entityNameValue = normalizeEntityName(value.name)
        let parentId = value.parents[0]
        let parent = parentId ? revitEntities.get(parentId) : null
        let parententityId = parent?.externalId
        // entitiesStream.write(`"description":"${description}",\n`)
        entity['description'] = `${description}`;
        // entitiesStream.write(`"entityId":"${entityIdValue}",\n`)
        entity['entityId'] = `${entityIdValue}`;
        if (parententityId) {
          // entitiesStream.write(`"entityName":"${entityNameValue}",\n`)
          // entitiesStream.write(`"parentEntityId":"${parententityId}"\n`)
          entity['parentEntityId'] = `${parententityId}`;
        } else {
          // entitiesStream.write(`"entityName":"${entityNameValue}"\n`)
        }
        entity['entityName'] = `${entityNameValue}`;

        //closing one entity
        // entitiesStream.write("}\n")
        entities.push(entity);
        // entityIndex++;



      }
    })



  //   entitiesStream.write("]\n")
  // }
  // catch(err: any) {
  //   console.error(err.message);
  // } finally {
  //   entitiesStream.end();
  // }

  // await fs.readFile(jsonPath, 'utf-8', (err, jsonString) => {
  //   if (err) {
  //     console.error(`Error reading file from disk: ${err}`);
  //   } else {
  //
  //   }
  // });

  fs.writeFileSync(path.join(outDir, 'entities.json'), JSON.stringify(entities, null, 4)); // TODO handle entity file name collisions
  tmdt_config['entities'] = 'entities.json';

  fs.writeFileSync(path.join(outDir, 'tmdt.json'), JSON.stringify(tmdt_config, null, 4));
  return tmdt_config;

}

// FIXME refactor
async function initEntitiesFromRevitJsonText(tmdt_config: tmdt_config_file, outDir: string, jsonText: string) {
  // console.log(revitJsonFilePath);

  const revitEntities: Map<number, any> = new Map();

// const jsonPath = path.resolve(__dirname, '../rme.json');
//   const jsonPath = path.resolve(__dirname, 'snowdon.json');
//   const jsonPath = path.resolve(revitJsonFilePath);
  const allCategoriesList = [
    "Document",
    "Family Type"
  ];

  // const mepCategoriesList = [
  //   "Air Systems",
  //   "Air Terminals",
  //   "Duct Fittings",
  //   "Duct Systems",
  //   "Ducts",
  //   "Electrical Equipment",
  //   "HVAC Zones",
  //   "Mechanical Equipment"
  // ];

  const allowedRevitCategories = [
    "Abutments",
    "Air Systems",
    "Air Terminals",
    "Analysis Display Style",
    "Analysis Results",
    "Areas",
    "Audio Visual Devices",
    "Bearings",
    "Bridge Cables",
    "Bridge Decks",
    "Bridge Framing",
    "Cable Tray Fittings",
    "Cable Tray Runs",
    "Cable Trays",
    "Casework",
    "Ceilings",
    "Columns",
    "Communication Devices",
    "Conduit Fittings",
    "Conduit Runs",
    "Conduits",
    "Coordination Model",
    "Curtain Grids",
    "Curtain Panels",
    "Curtain Systems",
    "Curtain Wall Mullions",
    "Data Devices",
    "Detail Items",
    "Doors",
    "Duct Accessories",
    "Duct Fittings",
    "Duct Insulations",
    "Duct Linings",
    "Duct Placeholders",
    "Duct Systems",
    "Ducts",
    "Electrical Circuits",
    "Electrical Equipment",
    "Electrical Fixtures",
    "Electrical Spare/Space Circuits",
    "Entourage",
    "Expansion Joints",
    "Filled region",
    "Fire Alarm Devices",
    "Fire Protection",
    "Flex Ducts",
    "Flex Pipes",
    "Floors",
    "Food Service Equipment",
    "Furniture",
    "Furniture Systems",
    "Generic Models",
    "Hardscape",
    "HVAC Zones",
    "Imports in Families",
    "Lighting Devices",
    "Lighting Fixtures",
    // "Lines",
    "Masking Region",
    "Mass",
    "Materials",
    "Mechanical Equipment",
    "Mechanical Equipment Sets",
    "Medical Equipment",
    "MEP Fabrication Containment",
    "MEP Fabrication Ductwork",
    "MEP Fabrication Hangers",
    "MEP Fabrication Pipework",
    "Nurse Call Devices",
    "Parking",
    "Parts",
    "Piers",
    "Pipe Accessories",
    "Pipe Fittings",
    "Pipe Insulations",
    "Pipe Placeholders",
    "Pipe Segments",
    "Pipes",
    "Piping Systems",
    "Planting",
    "Plumbing Fixtures",
    "Point Clouds",
    "Project Information",
    "Railings",
    "Ramps",
    "Raster Images",
    "Rebar Shape",
    "Roads",
    "Roofs",
    "Rooms",
    "Routing Preferences",
    "RVT Links",
    "Security Devices",
    "Shaft Openings",
    "Sheets",
    "Signage",
    "Site",
    "Spaces",
    "Specialty Equipment",
    "Sprinklers",
    "Stairs",
    "Structural Area Reinforcement",
    "Structural Beam Systems",
    "Structural Columns",
    "Structural Connections",
    "Structural Fabric Areas",
    "Structural Fabric Reinforcement",
    "Structural Foundations",
    "Structural Framing",
    "Structural Path Reinforcement",
    "Structural Rebar",
    "Structural Rebar Couplers",
    "Structural Stiffeners",
    "Structural Tendons",
    "Structural Trusses",
    "Switch System",
    "Telephone Devices",
    "Temporary Structures",
    "Topography",
    "Vertical Circulation",
    "Vibration Management",
    "Walls",
    "Water Loops",
    "Windows",
    "Wires",
    "Zone Equipment"
  ];



  // const CategoryComponentType = {
  //   "componentTypeId": "com.example.smartbuilding.revit.category",
  //   "description": "Stores category metadata from revit file",
  //   "isSingleton": false,
  //   "propertyDefinitions": {
  //     "category": {
  //       "dataType": {
  //         "type": "STRING"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     },
  //     "rc": {
  //       "dataType": {
  //         "type": "STRING"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     },
  //     "rfn": {
  //       "dataType": {
  //         "type": "STRING"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     },
  //     "rft": {
  //       "dataType": {
  //         "type": "STRING"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     }
  //   }
  // };

  // const MetadataComponentType = {
  //   "componentTypeId": "com.example.smartbuilding.revit.metadata",
  //   "description": "Stores identifiers metadata from revit file",
  //   "isSingleton": false,
  //   "propertyDefinitions": {
  //     "elementId": {
  //       "dataType": {
  //         "type": "STRING"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     },
  //     "externalId": {
  //       "dataType": {
  //         "type": "STRING"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     },
  //     "nodeId": {
  //       "dataType": {
  //         "type": "INTEGER"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     }
  //   }
  // };

  // const PropertiesComponentType = {
  //   "componentTypeId": "com.example.smartbuilding.revit.properties",
  //   "description": "Stores single group of properties from revit file",
  //   "isSingleton": false,
  //   "propertyDefinitions": {
  //     "properties": {
  //       "dataType": {
  //         "nestedType": {
  //           "type": "STRING"
  //         },
  //         "type": "MAP"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     },
  //     "propertyGroupName": {
  //       "dataType": {
  //         "type": "STRING"
  //       },
  //       "isExternalId": false,
  //       "isFinal": false,
  //       "isImported": false,
  //       "isInherited": false,
  //       "isRequiredInEntity": false,
  //       "isStoredExternally": false,
  //       "isTimeSeries": false
  //     }
  //   }
  // };

  // fs.writeFile('categorycomponenttype.json', JSON.stringify(CategoryComponentType, null, 2), (err) => {
  //   if (err) throw err;
  //   console.log('Data written to file');
  // });

  // let testMapValues: MapValue = {}
  // testMapValues["Insulation Thickness"] = {stringValue: "0.01 autodesk.unit.unit:meter"}
  // testMapValues["Insulation Type"] = {stringValue:"\"\""}
  // testMapValues["Overall Size"] = {stringValue:"42 mmx 475"}
  // let testProperties = createPropertiesObj(testMapValues, "Insulation")
  // fs.writeFile('properties.json', JSON.stringify(testProperties, null, 2), (err) => {
  //   if (err) throw err;
  //   console.log('testProperties obj written to ');
  // });
  //
  // let testCategoryObj = createCategoryObj("Revit Family Type", "Electrical Equipment", "M_Lighting and Appliance Panelboard", "125 A")
  // fs.writeFile("categorytest.json", JSON.stringify(testCategoryObj, null, 2), (err) => {
  //   if (err) throw err;
  //   console.log('test category obj written to ');
  // });

  // fs.writeFile('metadataentity1.json', JSON.stringify(metadataobj1, null, 2), (err) => {
  //   if (err) throw err;
  //   console.log('metadata obj written to ');
  // });
  //
  // fs.writeFile('metadataentity2.json', JSON.stringify(metadataobj2, null, 2), (err) => {
  //   if (err) throw err;
  //   console.log('metadata obj written to ');
  // });

  const revitObject = JSON.parse(jsonText);
  const jsonRevitEntities = revitObject.data.collection;
  console.log(`collection of the data child has size of : ${jsonRevitEntities.length}`);

  jsonRevitEntities.filter((element: any) =>
    (element.properties.__category__.Category &&
      (allowedRevitCategories.some(str => element.properties.__category__.Category.includes(str)) ||
        allCategoriesList.some(str => element.properties.__category__.Category.includes(str)))) ||
    (element.properties.__category__._RC&&
      (allowedRevitCategories.some(str => element.properties.__category__._RC.includes(str)) ||
        allCategoriesList.some(str => element.properties.__category__._RC.includes(str))))
  )
    .map((element: any) => revitEntities.set(element.objectid, element));
  console.log(`total count of revit entities is: ${revitEntities.size}`);

  // Write as entities

  const entities : any[] = [];

  // let entitiesStream: WriteStream = createWriteStream('/tmp/entitiesRevit.json');
  //
  // entitiesStream.on('error', (err: Error) => {
  //   console.error(`An error occurred writing entities.json: ${err.message}`);
  // });
  //
  //
  // try {
  //   entitiesStream.write("[\n")
  //   let entityIndex = 0;
  revitEntities.forEach((value, key) => {

    var entity : any = {};

    // FIXME - for testing just get root ones
    if (!value.parents[0]) {


      // if (entityIndex > 0) {
      //   entitiesStream.write(",\n")
      // }
      // entitiesStream.write("{\n")
      // entitiesStream.write("\"components\":{\n")

      entity['components'] = {}

      //Create and Write Category component
      let categoryValue = value.properties.__category__.Category
      let rcValue = value.properties.__category__._RC
      let rfhValue = value.properties.__category__._RFN
      let rftValue = value.properties.__category__._RFT
      let categoryObj = createCategoryObj(categoryValue, rcValue, rfhValue, rftValue)

      entity['components']['CATEGORY'] = categoryObj

      // entitiesStream.write("\"CATEGORY\":")
      // entitiesStream.write(JSON.stringify(categoryObj, null, 2))
      // entitiesStream.write(",\n")

      //Create and Write metadata component
      let elementIdValue = value.properties.__revit__?.ElementId
      let externalIdValue = value.externalId
      let nodeIdValue = value.objectid
      let metadataObj = createMetadataObject(elementIdValue, externalIdValue, nodeIdValue)

      entity['components']['METADATA'] = metadataObj

      // entitiesStream.write("\"METADATA\":")
      // entitiesStream.write(JSON.stringify(metadataObj, null, 2))
      // entitiesStream.write(",\n")

      //create and write all properties components
      // let propertyIndex = 0
      for (let prop in value.properties) {
        if (!prop.startsWith("__") && value.properties.hasOwnProperty(prop)) {
          // if (propertyIndex > 0) {
          //   entitiesStream.write(",\n")
          // }
          // entitiesStream.write(`\"${normalizeComponentName(prop)}\" : `)

          var mapValue : any = {};
          for (let sub_prop_key in value.properties[prop]) {
            mapValue[sub_prop_key] = {
              stringValue: normalizeIdentityData(value.properties[prop][sub_prop_key]) // TODO naming? why is this identity data in original scripts?
            }
          }

          let propertyMapValue: any = mapValue // MapValue = value.properties[prop]
          let propertyObj = createPropertiesObj(propertyMapValue, prop)
          entity['components'][`${normalizeComponentName(prop)}`] = propertyObj
          // entitiesStream.write(JSON.stringify(propertyObj, null, 2))
          // propertyIndex++
        }

      }

      //Close components section of entity
      // entitiesStream.write("},\n")

      //write top level entity properties: description, entityId, entityName, parententityId
      let description = `Generated entity for ${key}`
      let entityIdValue = value.externalId
      let entityNameValue = normalizeEntityName(value.name)
      let parentId = value.parents[0]
      let parent = parentId ? revitEntities.get(parentId) : null
      let parententityId = parent?.externalId
      // entitiesStream.write(`"description":"${description}",\n`)
      entity['description'] = `${description}`;
      // entitiesStream.write(`"entityId":"${entityIdValue}",\n`)
      entity['entityId'] = `${entityIdValue}`;
      if (parententityId) {
        // entitiesStream.write(`"entityName":"${entityNameValue}",\n`)
        // entitiesStream.write(`"parentEntityId":"${parententityId}"\n`)
        entity['parentEntityId'] = `${parententityId}`;
      } else {
        // entitiesStream.write(`"entityName":"${entityNameValue}"\n`)
      }
      entity['entityName'] = `${entityNameValue}`;

      //closing one entity
      // entitiesStream.write("}\n")
      entities.push(entity);
      // entityIndex++;



    }
  })



  //   entitiesStream.write("]\n")
  // }
  // catch(err: any) {
  //   console.error(err.message);
  // } finally {
  //   entitiesStream.end();
  // }

  // await fs.readFile(jsonPath, 'utf-8', (err, jsonString) => {
  //   if (err) {
  //     console.error(`Error reading file from disk: ${err}`);
  //   } else {
  //
  //   }
  // });

  fs.writeFileSync(path.join(outDir, 'entities.json'), JSON.stringify(entities, null, 4)); // TODO handle entity file name collisions
  tmdt_config['entities'] = 'entities.json';

  fs.writeFileSync(path.join(outDir, 'tmdt.json'), JSON.stringify(tmdt_config, null, 4));
  return tmdt_config;

}

// import component types

// // import scenes
// console.log('====== Scenes / Models ======');
// tmdt_config = await import_scenes_and_models(workspaceId, tmdt_config, outDir);
//
// // import entities
// console.log('========== Entities =========');
// tmdt_config = await import_entities(workspaceId, tmdt_config, outDir);


async function importRevitComponentTypes(tmdt_config: tmdt_config_file, outDir: string) {
  console.log('====== Component Types ======');
  var category_component_type = {
    "componentTypeId": "com.example.smartbuilding.revit.category",
    "description": "Stores category metadata from revit file",
    "isSingleton": false,
    "propertyDefinitions": {
      "category": {
        "dataType": {
          "type": "STRING"
        },
        "isExternalId": false,
        "isFinal": false,
        "isImported": false,
        "isInherited": false,
        "isRequiredInEntity": false,
        "isStoredExternally": false,
        "isTimeSeries": false
      },
      "rc": {
        "dataType": {
          "type": "STRING"
        },
        "isExternalId": false,
        "isFinal": false,
        "isImported": false,
        "isInherited": false,
        "isRequiredInEntity": false,
        "isStoredExternally": false,
        "isTimeSeries": false
      },
      "rfn": {
        "dataType": {
          "type": "STRING"
        },
        "isExternalId": false,
        "isFinal": false,
        "isImported": false,
        "isInherited": false,
        "isRequiredInEntity": false,
        "isStoredExternally": false,
        "isTimeSeries": false
      },
      "rft": {
        "dataType": {
          "type": "STRING"
        },
        "isExternalId": false,
        "isFinal": false,
        "isImported": false,
        "isInherited": false,
        "isRequiredInEntity": false,
        "isStoredExternally": false,
        "isTimeSeries": false
      }
    }
  };

  fs.writeFileSync(
    path.join(outDir, `com.example.smartbuilding.revit.category.json`),
    JSON.stringify(category_component_type, null, 4)
  );

  tmdt_config['component_types'].push(`com.example.smartbuilding.revit.category.json`);

  var metadata_component_type = {
    "componentTypeId": "com.example.smartbuilding.revit.metadata",
    "description": "Stores identifiers metadata from revit file",
    "isSingleton": false,
    "propertyDefinitions": {
      "externalId": {
        "dataType": {
          "type": "STRING"
        },
        "isExternalId": false,
        "isFinal": false,
        "isImported": false,
        "isInherited": false,
        "isRequiredInEntity": false,
        "isStoredExternally": false,
        "isTimeSeries": false
      },
      "elementId": {
        "dataType": {
          "type": "STRING"
        },
        "isExternalId": false,
        "isFinal": false,
        "isImported": false,
        "isInherited": false,
        "isRequiredInEntity": false,
        "isStoredExternally": false,
        "isTimeSeries": false
      },
      "nodeId": {
        "dataType": {
          "type": "INTEGER"
        },
        "isExternalId": false,
        "isFinal": false,
        "isImported": false,
        "isInherited": false,
        "isRequiredInEntity": false,
        "isStoredExternally": false,
        "isTimeSeries": false
      }
    }
  }

  fs.writeFileSync(
    path.join(outDir, `com.example.smartbuilding.revit.metadata.json`),
    JSON.stringify(metadata_component_type, null, 4)
  );

  tmdt_config['component_types'].push(`com.example.smartbuilding.revit.metadata.json`);

  var properties_component_type = {
    "componentTypeId": "com.example.smartbuilding.revit.properties",
    "description": "Stores single group of properties from revit file",
    "isSingleton": false,
    "propertyDefinitions": {
      "propertyGroupName": {
        "dataType": {
          "type": "STRING"
        },
        "isExternalId": false,
        "isFinal": false,
        "isImported": false,
        "isInherited": false,
        "isRequiredInEntity": false,
        "isStoredExternally": false,
        "isTimeSeries": false
      },
      "properties": {
        "dataType": {
          "type": "MAP",
          "nestedType": {
            "type": "STRING"
          }
        },
        "isExternalId": false,
        "isFinal": false,
        "isImported": false,
        "isInherited": false,
        "isRequiredInEntity": false,
        "isStoredExternally": false,
        "isTimeSeries": false
      }
    }
  };

  fs.writeFileSync(
    path.join(outDir, `com.example.smartbuilding.revit.properties.json`),
    JSON.stringify(properties_component_type, null, 4)
  );

  tmdt_config['component_types'].push(`com.example.smartbuilding.revit.properties.json`);

  return tmdt_config;
}


async function importRevitFile(tmdt_config: tmdt_config_file, outDir: string, rvtFile: string) {
  console.log('rvtFile', rvtFile);
  console.log(outDir);

  var forge_client_id = '8S1kvHTyVkaBdoKXnlPES9P4sBxHavGL';
  var forge_secret = 'spECwALtKGq9qT2r';
  const auth = new AuthenticationClient(forge_client_id, forge_secret); // If no params, gets credentials from env. vars FORGE_CLIENT_ID and FORGE_CLIENT_SECRET
  const authentication = await auth.authenticate(['bucket:read', 'data:read', 'data:write']);
  console.log('2-legged Token', authentication.access_token);

  var bucketName = 'johnnywu-revit-test'; // TODO config/param
  const data = new DataManagementClient(auth);
  // List buckets
  for await (const buckets of await data.buckets()) {
    console.log('Buckets', buckets.map(bucket => bucket.bucketKey).join(','));
  }

  // List objects in bucket
  for await (const objects of await data.objects(bucketName)) {
    console.log('Objects', objects.map(object => object.objectId).join(','));
  }

  // if (true) { // FIXME revert
  var rvtFileBuffer: Buffer = fs.readFileSync(path.join(rvtFile));
  console.log("rvtFileBuffer length", rvtFileBuffer.length);
  var res = await data.uploadObject(bucketName, `${rvtFile.split("/").slice(-1)[0]}`, 'application/octet-stream', rvtFileBuffer); // https://stackoverflow.com/questions/38339642/autodesk-forge-failed-to-trigger-translation-for-this-file
  // var res = await data.uploadObject(bucketName, 'snowdonRevitTest', rvtFile);
  // var res = data.uploadObject('johnnywu-revit-test', 'snowdonRevitTest', '/Users/johnnywu/Desktop/phoenix_revit/SnowdonSample.rvt');
  console.log(res);

  var objectUrn: string = res['objectId'];
  var objectUrnBase64 = Buffer.from(objectUrn, 'utf-8').toString('base64');
  console.log('objectUrnBase64', objectUrnBase64);

  const derivatives = new ModelDerivativeClient(auth);
  const job = await derivatives.submitJob(objectUrnBase64, [{ type: 'svf', views: ['2d', '3d'], advanced: {generateMasterViews: true} }]);
  console.log('Job', job);
  // }

  // var job =  {
  //   result: 'created',
  //   urn: 'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6am9obm55d3UtcmV2aXQtdGVzdC9zbm93ZG9uUmV2aXRUZXN0LnJ2dA',
  //   registerKeys: [ 'ba34c495-525c-4b98-8be0-6ff7244bd98c' ],
  //   // acceptedJobs: { output: { formats: [Array] } }
  // }


  // await axios.get(`https://developer.api.autodesk.com/modelderivative/v2/designdata/dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6am9obm55d3UtcmV2aXQtdGVzdC9zbm93ZG9uUmV2aXRUZXN0LnJ2dA/manifest`)

  var response: any = await get(`https://developer.api.autodesk.com/modelderivative/v2/designdata/${job.urn}/manifest`, {
    'Authorization': 'Bearer ' + authentication.access_token,
  });
  console.log(response);
  while (response['progress'] != 'complete') {
    await setTimeout(5000);
    response = await get(`https://developer.api.autodesk.com/modelderivative/v2/designdata/${job.urn}/manifest`, {
      'Authorization': 'Bearer ' + authentication.access_token,
    });
    console.log(response);
  }

  console.log("completed!")

  var resourceDir = '/tmp/rvtConvert/';

  if (true) { // TODO revert
  await run(job.urn, resourceDir, forge_client_id, forge_secret);
  // TODO note that the sqlite file isnt generated, though we're not using it either in the current pipeline
  }

  console.log("downloaded gltf files")

  // fs.readdirSync( resourceDir ).forEach( file => {
  //
  //   const extname = path.extname( file );
  //   const filename = path.basename( file, extname );
  //   const absolutePath = path.resolve( resourceDir, file );
  //
  //   console.log( "File : ", file );
  //   console.log( "filename : ", filename );
  //   console.log( "extname : ", extname );
  //   console.log( "absolutePath : ", absolutePath);
  //
  // });

  var modelFilePaths = [];

  if (true) {
  const files = fs.readdirSync(resourceDir, { withFileTypes: true });
  for (const file of files) {
    if (file.isDirectory()) {
      console.log(file.name)
      // var gltfpath = path.join(resourceDir, file.name, 'output.gltf')

      modelFilePaths.push(path.join(resourceDir, file.name, `${file.name}.glb`));

      if(true) {
      await run_gltf_pipeline(
        path.join(resourceDir, file.name, 'output.gltf'),
        path.join(resourceDir, file.name),
        path.join(resourceDir, file.name, `${file.name}.glb`))
      }
    }
  }
  }

  // run_gltf_pipeline(
  //   '/tmp/rvtConvert/0551915b-128a-ab63-ee4d-18825d101da1/output.gltf',
  //   '/tmp/rvtConvert/0551915b-128a-ab63-ee4d-18825d101da1/',
  //   '/tmp/rvtConvert/0551915b-128a-ab63-ee4d-18825d101da1/draco-out.glb')


  tmdt_config = await prepareSceneFile(tmdt_config, outDir, modelFilePaths);



  var properties_json_text = await extract_revit_properties(job.urn);

  tmdt_config = await initEntitiesFromRevitJsonText(tmdt_config, outDir, properties_json_text);



  return tmdt_config;
}


async function prepareSceneFile(tmdt_config: tmdt_config_file, outDir: string, model_file_paths: string[]) {

  console.log('modelFilePaths', model_file_paths);

  // for each file in model_file_paths: add to root in scene, move model ref to out location, add to tmdt config
  // save scene to tmdt config

  var twinMakerScene = new IotTwinMakerSceneImpl('', 'snowdon', '');

  // Clear scene to fully overwrite it
  // twinMakerScene.clear();

  // Add a Root Node to the Scene
  console.log('Building Cookie Factory scene...');
  const rootNode = new EmptyNode('AWSIoTTwinMakerScene');

  // Set the Environmental Preset in the Scene settings
  twinMakerScene.setEnviromentPreset('neutral');
  twinMakerScene.addRootNode(rootNode);

  // // Create new Rules with statements - ALARM ICON
  // const alarmRuleMap: Rule = new Rule();
  // const alarmRuleName = 'AlarmRuleMap';
  // const alarmRuleStatement = new Statement('alarm_status == ACTIVE', Target.ERROR);
  // alarmRuleMap.addStatement(alarmRuleStatement);
  //
  // // Create new Rules with statements - MESH COLOR
  // const meshColorRuleMap: Rule = new Rule();
  // const meshColorRuleName = 'MeshColorRuleMap';
  // const meshColorRuleStatementRed = new Statement('Temperature > 100', Target.RED);
  // const meshColorRuleStatementYellow = new Statement('Temperature < 99', Target.YELLOW);
  // meshColorRuleMap.addStatement(meshColorRuleStatementRed);
  // meshColorRuleMap.addStatement(meshColorRuleStatementYellow);
  //
  // // Create new Rules with statements - WATERTANK COLOR
  // const waterTankFlowRuleMap: Rule = new Rule();
  // const waterTankFlowRuleName = 'WaterTankFlowRuleMap';
  // const waterTankFlowRuleRed = new Statement('flowRate1 > 40', Target.RED);
  // const waterTankFlowRuleGreen = new Statement('flowRate1 <= 40', Target.GREEN);
  // waterTankFlowRuleMap.addStatement(waterTankFlowRuleRed);
  // waterTankFlowRuleMap.addStatement(waterTankFlowRuleGreen);
  //
  // // Add Rules to the Scene
  // twinMakerScene.addRule(alarmRuleName, alarmRuleMap);
  // twinMakerScene.addRule(meshColorRuleName, meshColorRuleMap);
  // twinMakerScene.addRule(waterTankFlowRuleName, waterTankFlowRuleMap);
  //
  // // Add Environment Model
  // const environmentAssetFile = `${assetDirPath}CookieFactoryEnvironment.glb`;
  // const environmentNode: ModelRefNode = assetToModelRef(environmentAssetFile, 'Environment');
  // environmentNode.withCastShadow(true).withReceiveShadow(true);

  // // Upload the Asset for 3D Model
  // environmentNode.uploadModelFromLocalIfNotExist(environmentAssetFile);

  // // Add Node to the Scene
  // rootNode.addChildNode(environmentNode);

  // // Add Equipment Node
  // const equipmentNode = new EmptyNode('Equipment');
  // environmentNode.addChildNode(equipmentNode);

  // add asset node
  const assetNode = new EmptyNode('Snowdon');
  rootNode.addChildNode(assetNode);

  if (!fs.existsSync(path.join(outDir, '3d_models'))) {
    fs.mkdirSync(path.join(outDir, '3d_models'));
  }

  for (var modelFilePath of model_file_paths) {

    var modelFileName = modelFilePath.split("/").slice(-1)[0]

    const meshNode = new ModelRefNode(`${modelFileName.substring(0, modelFileName.length-4)}`, modelFileName, 'GLB');

    assetNode.addChildNode(meshNode)

    fs.copyFileSync(modelFilePath, path.join(outDir, '3d_models', modelFileName));

    tmdt_config.models.push(modelFileName);

  }


  // // Add Parent Nodes within Equipment
  // const mixersNode = new EmptyNode('Mixers');
  // const cookieLinesNode = new EmptyNode('CookieLines');
  // equipmentNode.addChildNode(mixersNode);
  // equipmentNode.addChildNode(cookieLinesNode);
  //
  // // Add Cookie Lines
  // console.log('Adding Cookie Lines...');
  // const cookieLineAssetFile = `${assetDirPath}CookieFactoryLine.glb`;
  // const cookieLineNode: ModelRefNode = assetToModelRef(cookieLineAssetFile, 'COOKIE_LINE');
  // cookieLineNode.withCastShadow(true).withReceiveShadow(true);
  // const cookieLineNode1: ModelRefNode = assetToModelRef(cookieLineAssetFile, 'COOKIE_LINE_1');
  // cookieLineNode1.withCastShadow(true).withReceiveShadow(true);
  // const cookieLineNode2: ModelRefNode = assetToModelRef(cookieLineAssetFile, 'COOKIE_LINE_2');
  // cookieLineNode2.withCastShadow(true).withReceiveShadow(true);
  // cookieLineNode.uploadModelFromLocalIfNotExist(cookieLineAssetFile);
  //
  // cookieLineNode.withPosition({ x: 26, y: -2.5, z: 45 });
  // cookieLineNode1.withPosition({ x: 9.5, y: -2.5, z: 45 });
  // cookieLineNode2.withPosition({ x: -7, y: -2.5, z: 45 });
  //
  // cookieLinesNode.addChildNode(cookieLineNode);
  // cookieLinesNode.addChildNode(cookieLineNode1);
  // cookieLinesNode.addChildNode(cookieLineNode2);
  //
  // // Add Mixers with Data Bindings for Entity Alarm Data
  // const listEntitiesFilter: ListEntitiesFilter = {
  //   componentTypeId: 'com.example.cookiefactory.alarm',
  // };
  //
  // const mixerTransformCsvPath = `${__dirname}/MixerTransform.csv`;
  // const csvResult = parseCsv(mixerTransformCsvPath);
  //
  // console.log('Adding Mixers and WaterTank...');
  // const addModelAndRuleForEntity = (entitySummary: EntitySummary) => {
  //   if (entitySummary.entityId.includes('Mixer')) {
  //     // Create an instance of Tag Node
  //     const tagNode: TagNode = new TagNode('Tag');
  //
  //     const dataBinding = new DataBinding();
  //
  //     // Set the Entity ID, Component Name and Property Name in data binding
  //     dataBinding
  //       .withTargetEntityId(entitySummary.entityId)
  //       .withTargetComponentName('AlarmComponent')
  //       .withTargetProperty('alarm_status');
  //
  //     // Update the Tag Node with a position and the above data binding and rule
  //     tagNode
  //       .withDataBinding(dataBinding)
  //       .withTarget(Target.INFO)
  //       .withRuleId(alarmRuleName)
  //       .withPosition({ x: 0, y: 2.84, z: 0 });
  //
  //     // Set Nav Link parameters on the tag
  //     // Expect entity name to be "Mixer_{NUM}"
  //     const cameraNum = Number(entitySummary.entityName.slice(6)) > 12 ? '1' : '2';
  //     tagNode.withNavLink(
  //       new NavLink().withParams(
  //         new Map([
  //           ['kvs_stream_name', `cookiefactory_mixerroom_camera_0${cameraNum}`],
  //           ['sel_entity_name', entitySummary.entityName],
  //         ]),
  //       ),
  //     );
  //
  //     // Prepare 3D Model
  //     const mixerAssetFile = `${assetDirPath}CookieFactoryMixer.glb`;
  //     const modelRefNode: ModelRefNode = assetToModelRef(mixerAssetFile, entitySummary.entityName);
  //     modelRefNode.withCastShadow(true).withReceiveShadow(true);
  //     modelRefNode.uploadModelFromLocalIfNotExist(mixerAssetFile);
  //
  //     // Add Tag to 3D Model node
  //     modelRefNode.addChildNode(tagNode);
  //
  //     // Set Mixer Transform
  //     processMixerTransform(modelRefNode, entitySummary.entityName, csvResult);
  //
  //     // Add 3D Model to the Scene
  //     mixersNode.addChildNode(modelRefNode);
  //   } else if (entitySummary.entityId.includes('WaterTank')) {
  //     // Prepare Tag
  //     const tagNode: TagNode = new TagNode('Tag');
  //     const tagDataBinding = new DataBinding();
  //
  //     tagDataBinding
  //       .withTargetEntityId(entitySummary.entityId)
  //       .withTargetComponentName('AlarmComponent')
  //       .withTargetProperty('alarm_status');
  //
  //     // Update the Tag Node with a position and the above data binding and rule
  //     tagNode
  //       .withDataBinding(tagDataBinding)
  //       .withTarget(Target.INFO)
  //       .withRuleId(alarmRuleName)
  //       .withPosition({ x: 0, y: 0.86, z: 0 });
  //
  //     tagNode.withNavLink(new NavLink().withParams(new Map([['sel_entity_name', entitySummary.entityName]])));
  //
  //     // Prepare 3D Model
  //     const waterTankAssetFile = `${assetDirPath}CookieFactoryWaterTank.glb`;
  //     const waterTankNode: ModelRefNode = assetToModelRef(waterTankAssetFile, 'WaterTank');
  //     waterTankNode.withCastShadow(true).withReceiveShadow(true);
  //     waterTankNode.uploadModelFromLocalIfNotExist(waterTankAssetFile);
  //
  //     waterTankNode.withPosition({ x: 32.6, y: 0, z: 47 });
  //     waterTankNode.addChildNode(tagNode);
  //
  //     // Create an instance of Motion Indicator node
  //     const motionIndicator: MotionIndicatorNode = new MotionIndicatorNode('MotionIndicator');
  //
  //     // Set Motion Indicator features and transform
  //     motionIndicator
  //       .setMotionIndicatorShape('LinearPlane')
  //       .setMotionDefaultSpeed(1)
  //       .setDefaultForegroundColor(0xffff00) // YELLOW
  //       .setNumOfRepeatInY(1)
  //       .withPosition({ x: 1.4, y: 3, z: -3 })
  //       .withRotation({ x: 0, y: 270, z: 0 })
  //       .withScale({ x: 7, y: 1, z: 1 });
  //
  //     waterTankNode.addChildNode(motionIndicator);
  //
  //     // Create a Model Shader instance with data binding and rule
  //     const waterTankDataBinding = new DataBinding();
  //     tagDataBinding
  //       .withTargetEntityId(entitySummary.entityId)
  //       .withTargetComponentName('WaterTank')
  //       .withTargetProperty('flowRate1');
  //
  //     const modelShader: ModelShader = new ModelShader()
  //       .withValueDataBinding(waterTankDataBinding)
  //       .withRuleId(waterTankFlowRuleName);
  //
  //     waterTankNode.addModelShader(modelShader);
  //     equipmentNode.addChildNode(waterTankNode);
  //   }
  // };

  // const factory = new SceneFactoryImpl();

  var serializer: Serializer = new Serializer();


  // factory.saveLocal(twinMakerScene, '/tmp/rvtConvert')
  twinMakerScene.selfCheck();
  const sceneId = twinMakerScene.getSceneId();

  const sceneFile = `${withTrailingSlash(outDir)}${sceneId}.json`;
  const sceneJson = serializer.serializeScene(twinMakerScene as IotTwinMakerSceneImpl);
  // Write scene JSON to the provided localPath
  fs.writeFileSync(sceneFile, sceneJson);
  console.log(`${sceneId}.json saved to ${'/tmp/rvtConvert'} !`);

  tmdt_config.scenes.push(`${sceneId}.json`)

  return tmdt_config;
}

export { initEntitiesFromRevitJson, importRevitComponentTypes, importRevitFile};
