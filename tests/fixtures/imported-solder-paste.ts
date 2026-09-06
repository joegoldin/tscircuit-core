import type { CircuitJson, PcbSolderPaste } from "circuit-json"
import type { FootprintProp } from "@tscircuit/props"

// The installed props package's legacy array type omits paste, which the
// Circuit JSON import boundary accepts without a public JSX API extension.
export const asImportedFootprint = (footprint: CircuitJson): FootprintProp =>
  footprint as unknown as FootprintProp

export const createNineWindowFootprint = (): CircuitJson => [
  ...[-1.4, 0, 1.4].flatMap((x, column) =>
    [-1.4, 0, 1.4].map((y, row): PcbSolderPaste => ({
      type: "pcb_solder_paste",
      pcb_solder_paste_id: `window_${column}_${row}`,
      pcb_smtpad_id: "ep",
      shape: "pill",
      x,
      y,
      width: 1.13,
      height: 1.13,
      radius: 0.25,
      layer: "top",
    })),
  ),
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "ep",
    shape: "rect",
    width: 4.2,
    height: 4.2,
    x: 0,
    y: 0,
    layer: "top",
    port_hints: ["1"],
  },
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "neighbor",
    shape: "rect",
    width: 0.8,
    height: 0.4,
    x: 3,
    y: 0,
    layer: "top",
    port_hints: ["2"],
  },
]
