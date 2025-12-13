import JSZip from "jszip";

export async function createSample3mf() {
  const zip = new JSZip();
  const metadata = {
    printer: {
      name: "Bambu P1P",
      nozzle_diameter_mm: 0.4,
    },
    filaments: [
      {
        id: "0",
        name: "Bambu PLA Basic",
        material_family: "PLA",
        color: "Gray",
        nozzle_temp_recommended_range_c: [190, 220],
        bed_temp_recommended_range_c: [45, 60],
      },
    ],
    settings: {
      layer_height_mm: 0.2,
      first_layer_height_mm: 0.2,
      wall_line_count: 2,
      top_layers: 4,
      bottom_layers: 4,
      infill_density_percent: 15,
      infill_pattern: "grid",
      nozzle_temp_c: 205,
      bed_temp_c: 60,
      fan_speed_percent: 80,
      first_layers_fan_percent: 40,
      speeds: {
        wall_outer: 40,
        wall_inner: 60,
        infill: 80,
        first_layer: 30,
      },
      supports_enabled: false,
      adhesion_type: "brim",
    },
    quality_preset: "bambu_default_standard",
    plates: [
      {
        index: 0,
        name: "Plate 1",
        objects: [
          {
            name: "CalibrationCube",
            bounding_box_mm: [20, 20, 20],
            geometry: {
              bounding_box_mm: [20, 20, 20],
              max_dimension_mm: 20,
              min_dimension_mm: 20,
              height_to_min_footprint_ratio: 1,
              is_slender: false,
            },
            settings: {
              supports_enabled: false,
            },
          },
        ],
      },
    ],
  };
  zip.file("BambuStudio/metadata.json", JSON.stringify(metadata, null, 2));
  const config = {
    printer_model: "Bambu Lab H2S",
    nozzle_diameter: ["0.4"],
    filament_type: ["PETG"],
    filament_vendor: "VendorX",
    filament_colour: ["#898989"],
    default_print_profile: "0.20mm Standard @BBL H2S",
    layer_height: "0.22",
    initial_layer_print_height: "0.2",
    wall_loops: "3",
    top_shell_layers: "5",
    bottom_shell_layers: "4",
    sparse_infill_density: "25%",
    sparse_infill_pattern: "grid",
    nozzle_temperature: ["245"],
    eng_plate_temp: ["70"],
    fan_max_speed: ["90"],
    enable_support: "1",
    brim_width: "5",
    filament_colour_type: ["0"],
    nozzle_temperature_range_low: ["230"],
    nozzle_temperature_range_high: ["270"],
  };
  zip.file("config.json", JSON.stringify(config, null, 2));
  const modelXml =
    '<model><resources><object id="1" name="CalibrationCube"><mesh><triangles><triangle v1="0" v2="1" v3="2"/></triangles></mesh></object></resources></model>';
  zip.file("3D/3dmodel.model", modelXml);
  zip.file("dummy.txt", "preserve me");
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return { buffer, metadata };
}
