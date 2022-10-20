// @ts-ignore
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { Matrix4, LineBasicMaterial, Vector3, BufferGeometry, Line } from 'three';
import { IFCLoader } from 'web-ifc-three/IFCLoader';
import { LoaderSettings } from 'web-ifc';
import { IFCModel } from 'web-ifc-three/IFC/components/IFCModel';
import { IfcComponent } from '../../base-types';
import { IfcUnits } from './units';
import { IfcSelector } from './selection/selector';
import { IfcContext } from '../context';
import { IfcProperties } from './ifc-properties';

export class IfcManager extends IfcComponent {
  loader: IFCLoader;
  selector: IfcSelector;
  units: IfcUnits;
  properties: IfcProperties;
  private readonly context: IfcContext;

  constructor(context: IfcContext) {
    super(context);
    this.context = context;
    this.loader = new IFCLoader();
    this.setupThreeMeshBVH();
    this.selector = new IfcSelector(context, this);
    this.units = new IfcUnits(this);
    this.properties = new IfcProperties(context, this.loader);
  }

  async dispose() {
    (this.context as any) = null;
    this.selector.dispose();
    (this.selector as any) = null;
    this.units.dispose();
    (this.units as any) = null;
    this.properties.dispose();
    (this.properties as any) = null;
    await this.loader.ifcManager.dispose();
    (this.loader as any) = null;
  }

  /**
   * Loads the given IFC in the current scene.
   * @file IFC as File.
   * @fitToFrame (optional) if true, brings the perspectiveCamera to the loaded IFC.
   * @onError (optional) a callback function to report on loading errors
   */
  async loadIfc(file: File, fitToFrame = false, onError?: (err: any) => any) {
    const url = URL.createObjectURL(file);
    return this.loadIfcUrl(url, fitToFrame, undefined, onError);
  }

  /**
   * Loads the given IFC in the current scene.
   * @file IFC as URL.
   * @fitToFrame (optional) if true, brings the perspectiveCamera to the loaded IFC.
   * @onProgress (optional) a callback function to report on downloading progress
   * @onError (optional) a callback function to report on loading errors
   */
  async loadIfcUrl(
    url: string,
    fitToFrame = false,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: any) => any
  ) {
    try {
      const firstModel = Boolean(this.context.items.ifcModels.length === 0);

      const settings = this.loader.ifcManager.state.webIfcSettings;
      const fastBools = settings?.USE_FAST_BOOLS || true;

      await this.loader.ifcManager.applyWebIfcConfig({
        COORDINATE_TO_ORIGIN: firstModel,
        USE_FAST_BOOLS: fastBools
      });

      const ifcModel = await this.loader.loadAsync(url, onProgress);
      this.addIfcModel(ifcModel);

      if (firstModel) {
        const matrixArr = await this.loader.ifcManager.ifcAPI.GetCoordinationMatrix(
          ifcModel.modelID
        );
        const matrix = new Matrix4().fromArray(matrixArr);
        this.loader.ifcManager.setupCoordinationMatrix(matrix);
      }

      if (fitToFrame) this.context.fitToFrame();

      return ifcModel;
    } catch (err) {
      console.error('Error loading IFC.');
      console.error(err);
      if (onError) onError(err);
      return null;
    }
  }

  async loadAlignments() {
    this.addAlignmentsToScene(this.loader.ifcManager.state.alignments);
  }

  /**
   * Sets the relative path of web-ifc.wasm file in the project.
   * Beware: you **must** serve this file in your page; this means
   * that you have to copy this files from *node_modules/web-ifc*
   * to your deployment directory.
   *
   * If you don't use this methods,
   * IFC.js assumes that you are serving it in the root directory.
   *
   * Example if web-ifc.wasm is in dist/wasmDir:
   * `ifcLoader.setWasmPath("dist/wasmDir/");`
   *
   * @path Relative path to web-ifc.wasm.
   */
  async setWasmPath(path: string) {
    await this.loader.ifcManager.setWasmPath(path);
  }

  /**
   * Applies a configuration for [web-ifc](https://ifcjs.github.io/info/docs/Guide/web-ifc/Introduction).
   */
  async applyWebIfcConfig(settings: LoaderSettings) {
    await this.loader.ifcManager.applyWebIfcConfig(settings);
  }

  /**
   * Gets the spatial structure of the specified model.
   * @modelID ID of the IFC model.
   */
  getSpatialStructure(modelID: number, includeProperties?: boolean) {
    return this.loader.ifcManager.getSpatialStructure(modelID, includeProperties);
  }

  /**
   * Gets the properties of the specified item.
   * @modelID ID of the IFC model.
   * @id Express ID of the item.
   * @indirect If true, also returns psets, qsets and type properties.
   * @recursive If true, this gets the native properties of the referenced elements recursively.
   */
  async getProperties(modelID: number, id: number, indirect: boolean, recursive?: boolean) {
    if (modelID == null || id == null) return null;
    const props = await this.loader.ifcManager.getItemProperties(modelID, id, recursive);
    if (indirect) {
      props.psets = await this.loader.ifcManager.getPropertySets(modelID, id, recursive);
      props.mats = await this.loader.ifcManager.getMaterialsProperties(modelID, id, recursive);
      props.type = await this.loader.ifcManager.getTypeProperties(modelID, id, recursive);
    }
    return props;
  }

  /**
   * Gets the ID of the model pointed by the cursor.
   */
  getModelID() {
    const found = this.context.castRayIfc();
    if (!found) return null;
    const mesh = found.object as IFCModel;
    if (!mesh || mesh.modelID === undefined || mesh.modelID === null) return null;
    return mesh.modelID;
  }

  /**
   * Gets all the items of the specified type in the specified IFC model.
   * @modelID ID of the IFC model.
   * @type type of element. You can import the type from web-ifc.
   * @verbose If true, also gets the properties for all the elements.
   */
  getAllItemsOfType(modelID: number, type: number, verbose = false) {
    return this.loader.ifcManager.getAllItemsOfType(modelID, type, verbose);
  }

  /**
   * @deprecated: use IFC.selector.prePickIfcItem() instead.
   */
  async prePickIfcItem() {
    await this.selector.prePickIfcItem();
  }

  /**
   * @deprecated: use IFC.selector.pickIfcItem() instead.
   */
  async pickIfcItem(focusSelection = false) {
    return this.selector.pickIfcItem(focusSelection);
  }

  /**
   * @deprecated: use IFC.selector.highlightIfcItem() instead.
   */
  async highlightIfcItem(focusSelection = false) {
    return this.selector.highlightIfcItem(focusSelection);
  }

  /**
   * @deprecated: use IFC.selector.pickIfcItemsByID() instead.
   */
  async pickIfcItemsByID(modelID: number, ids: number[], focusSelection = false) {
    await this.selector.pickIfcItemsByID(modelID, ids, focusSelection);
  }

  /**
   * @deprecated: use IFC.selector.prepickIfcItemsByID() instead.
   */
  async prepickIfcItemsByID(modelID: number, ids: number[], focusSelection = false) {
    await this.selector.prepickIfcItemsByID(modelID, ids, focusSelection);
  }

  /**
   * @deprecated: use IFC.selector.highlightIfcItemsByID() instead.
   */
  async highlightIfcItemsByID(modelID: number, ids: number[], focusSelection = false) {
    await this.selector.highlightIfcItemsByID(modelID, ids, focusSelection);
  }

  /**
   * @deprecated: use IFC.selector.unpickIfcItems() instead.
   */
  unpickIfcItems() {
    this.selector.unpickIfcItems();
  }

  /**
   * @deprecated: use IFC.selector.unPrepickIfcItems() instead.
   */
  unPrepickIfcItems() {
    this.selector.unPrepickIfcItems();
  }

  /**
   * @deprecated: use IFC.selector.unHighlightIfcItems() instead.
   */
  unHighlightIfcItems() {
    this.selector.unHighlightIfcItems();
  }

  private addIfcModel(ifcMesh: IFCModel) {
    this.context.items.ifcModels.push(ifcMesh);
    this.context.items.pickableIfcModels.push(ifcMesh);
    this.context.getScene().add(ifcMesh);
  }

  private addAlignmentsToScene(modelAlignments: any) {
    //create a blue LineBasicMaterial
    let material = new LineBasicMaterial({ color: 0x0000ff, linewidth: 5 });
    if (modelAlignments.length > 0) {
      const alignments = modelAlignments[0];
      for (let m = 0; m < alignments.length; m++) {
        const alignment = alignments[m];
        const origin = { x: 0, y: 0, z: 0 };
        const start = { x: 0, y: 0, z: 0 };

        origin.x = alignment.origin.x;
        origin.y = alignment.origin.z;
        origin.z = alignment.origin.y;

        let finish = false;
        for (let i = 0; i < alignment.horizontal.length; i++) {
          for (let j = 0; j < alignment.horizontal[i].points.length; j++) {
            start.x = alignment.horizontal[i].points[j].x - origin.x;
            start.y = 0;
            start.z = -(alignment.horizontal[i].points[j].y - origin.z);
            finish = true;
            break;
          }
          if (finish) { break; }
        }

        //Horizontal alignment

        for (let i = 0; i < alignment.horizontal.length; i++) {
          const points = [];
          for (let j = 0; j < alignment.horizontal[i].points.length; j++) {
            points.push(new Vector3(
              alignment.horizontal[i].points[j].x - origin.x - start.x,
              0,
              -(alignment.horizontal[i].points[j].y - origin.z - start.z))
            );
          }
          const geometry = new BufferGeometry().setFromPoints(points);

          // // Create Tube Geometry for alignments -> requires to add reference to , TubeGeometry, CatmullRomCurve3 in three (header)
          // var tubeGeometry = new TubeGeometry(
          //   new CatmullRomCurve3(points),
          //   30,// path segments
          //   0.2,// THICKNESS
          //   6, //Roundness of Tube
          //   false //closed
          // );
          // const line = new Line(tubeGeometry, material);

          const line = new Line(geometry, material);
          this.context.getScene().add(line);
        }

        //Vertical alignment

        material = new LineBasicMaterial({ color: 0xff0000, linewidth: 5 });
        for (let i = 0; i < alignment.vertical.length; i++) {
          const points = [];
          for (let j = 0; j < alignment.vertical[i].points.length; j++) {
            points.push(new Vector3(
              alignment.vertical[i].points[j].x,
              alignment.vertical[i].points[j].y - origin.y,
              start.z)
            );
          }
          const geometry = new BufferGeometry().setFromPoints(points);
          const line = new Line(geometry, material);
          this.context.getScene().add(line);
        }

        //3D polyline
        console.log(alignment);
        let lastx = 0;
        let lasty = 0;
        let length = 0;
        material = new LineBasicMaterial({ color: 0xffdd00 });
        for (let i = 0; i < alignment.horizontal.length; i++) {
          const points = [];
          for (let j = 0; j < alignment.horizontal[i].points.length; j++) {
            let alt = 0;
            if (i == 0 && j == 0) {
              lastx = alignment.horizontal[i].points[j].x;
              lasty = alignment.horizontal[i].points[j].y
            }
            const valueX = alignment.horizontal[i].points[j].x - lastx;
            const valueY = alignment.horizontal[i].points[j].y - lasty;
            lastx = alignment.horizontal[i].points[j].x;
            lasty = alignment.horizontal[i].points[j].y;
            length += Math.sqrt(valueX * valueX + valueY * valueY);
            let first = true;
            let lastAlt = 0;
            let lastxx = 0;
            let done = false;
            for (let ii = 0; ii < alignment.vertical.length; ii++) {
              for (let jj = 0; jj < alignment.vertical[ii].points.length; jj++) {
                if (first) {
                  first = false;
                  alt = alignment.vertical[ii].points[jj].y;
                  lastAlt = alignment.vertical[ii].points[jj].y;
                  if (alignment.vertical[ii].points[jj].x >= length)
                  {
                    break;
                  }
                }
                if (alignment.vertical[ii].points[jj].x >= length) {
                  const value1 = alignment.vertical[ii].points[jj].x - lastxx;
                  const value2 = length - lastxx;
                  const value3 = 1 - (value2 / value1);
                  alt = (lastAlt * value3) +
                    (alignment.vertical[ii].points[jj].y) * (1 - value3);
                  done = true;
                  break;
                }
                lastAlt = alignment.vertical[ii].points[jj].y;
                lastxx = alignment.vertical[ii].points[jj].x;
              }
              if (done) { break; }
            }
            console.log(origin);
            alt -= origin.y;
            points.push(new Vector3(
              alignment.horizontal[i].points[j].x - origin.x - start.x,
              alt,
              -(alignment.horizontal[i].points[j].y - origin.z - start.z))
            );
          }
          const geometry = new BufferGeometry().setFromPoints(points);
          const line = new Line(geometry, material);
          this.context.getScene().add(line);
        }
      }
    }
  }

  private setupThreeMeshBVH() {
    this.loader.ifcManager.setupThreeMeshBVH(
      computeBoundsTree,
      disposeBoundsTree,
      acceleratedRaycast
    );
  }
}
