import { pcbLayoutProps } from "@tscircuit/props"
import { pcb_solder_paste, type PcbSolderPaste } from "circuit-json"
import { applyToPoint } from "transformation-matrix"
import { PrimitiveComponent } from "../base-components/PrimitiveComponent"
import type { SmtPad } from "./SmtPad"

const importedSolderPasteProps = pcbLayoutProps.extend({
  aperture: pcb_solder_paste,
})

/**
 * Internal footprint-local aperture, in mm in the right-handed PCB frame:
 * +X right, +Y up, +Z above the board. Its center is a point; pcbRotation
 * describes its local axes before the parent transform and layer reflection.
 */
export class ImportedSolderPaste extends PrimitiveComponent<
  typeof importedSolderPasteProps
> {
  isPcbPrimitive = true
  linkedSmtPad?: SmtPad
  pcb_solder_paste_id: PcbSolderPaste["pcb_solder_paste_id"] | null = null

  get config() {
    return {
      componentName: "ImportedSolderPaste",
      zodProps: importedSolderPasteProps,
    }
  }

  getPcbSize(): { width: number; height: number } {
    const { aperture } = this._parsedProps
    return aperture.shape === "circle"
      ? { width: aperture.radius * 2, height: aperture.radius * 2 }
      : { width: aperture.width, height: aperture.height }
  }

  doInitialPcbPrimitiveRender(): void {
    if (this.root?.pcbDisabled) return
    const { aperture } = this._parsedProps
    // Use the same parent · flipY · local placement as physical PCB primitives.
    const transform = this._computePcbGlobalTransformBeforeLayout()
    const position = applyToPoint(transform, { x: 0, y: 0 })
    const xAxisPoint = applyToPoint(transform, { x: 1, y: 0 })
    const angle =
      (Math.atan2(xAxisPoint.y - position.y, xAxisPoint.x - position.x) * 180) /
      Math.PI
    const ccwRotation = ((angle % 180) + 180) % 180
    const quarterTurn = Math.round(ccwRotation / 90)
    const isAxisAligned = Math.abs(ccwRotation - quarterTurn * 90) < 1e-9
    const swapDimensions = isAxisAligned && quarterTurn % 2 === 1
    const { maybeFlipLayer } = this._getPcbPrimitiveFlippedHelpers()
    const linkedPadId = this.linkedSmtPad?.pcb_smtpad_id
    if (this.linkedSmtPad && !linkedPadId) {
      throw new Error(
        `Imported solder paste ${aperture.pcb_solder_paste_id} rendered before its linked pad`,
      )
    }
    const placement = {
      ...position,
      layer: maybeFlipLayer(aperture.layer),
      pcb_component_id:
        this.getPrimitiveContainer()?.pcb_component_id ?? undefined,
      pcb_smtpad_id: linkedPadId ?? undefined,
      pcb_group_id: this.getGroup()?.pcb_group_id ?? undefined,
      subcircuit_id: this.getSubcircuit()?.subcircuit_id ?? undefined,
    }
    let geometry: PcbSolderPaste
    if (aperture.shape === "circle") {
      geometry = { ...aperture, ...placement }
    } else if (aperture.shape === "oval") {
      if (!isAxisAligned && aperture.width !== aperture.height) {
        throw new Error(
          `Imported solder paste oval ${aperture.pcb_solder_paste_id} cannot represent rotation ${ccwRotation}`,
        )
      }
      geometry = {
        ...aperture,
        ...placement,
        width: swapDimensions ? aperture.height : aperture.width,
        height: swapDimensions ? aperture.width : aperture.height,
      }
    } else {
      const rounded =
        aperture.shape === "pill" || aperture.shape === "rotated_pill"
      const dimensions = {
        type: aperture.type,
        pcb_solder_paste_id: aperture.pcb_solder_paste_id,
        ...placement,
        width: swapDimensions ? aperture.height : aperture.width,
        height: swapDimensions ? aperture.width : aperture.height,
      }
      geometry = rounded
        ? isAxisAligned
          ? { ...dimensions, shape: "pill", radius: aperture.radius }
          : {
              ...dimensions,
              shape: "rotated_pill",
              radius: aperture.radius,
              ccw_rotation: ccwRotation,
            }
        : isAxisAligned
          ? { ...dimensions, shape: "rect" }
          : { ...dimensions, shape: "rotated_rect", ccw_rotation: ccwRotation }
    }
    // Imported IDs identify source associations, never new circuit instances.
    const { pcb_solder_paste_id, type, ...insert } = geometry
    this.pcb_solder_paste_id =
      this.root!.db.pcb_solder_paste.insert(insert).pcb_solder_paste_id
  }
}
