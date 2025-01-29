import React, { useState } from "react";
import { SketchPicker, type RGBColor } from "react-color";

const ColorPicker = () => {
  const [color, setColor] = useState("#ff0000");

  return (
    <div className="absolute top-0 right-0">
      <SketchPicker
        color={color}
        onChange={(result: { hex: string; rgb: RGBColor }) => setColor(result.hex)}
      />
      <p>Selected Color: {color}</p>
      <div
        style={{
          width: "50px",
          height: "50px",
          background: color,
          marginTop: "10px",
        }}
      />
    </div>
  );
};

export default ColorPicker;
