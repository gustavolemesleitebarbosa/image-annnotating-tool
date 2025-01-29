import React, { useState } from "react";
import { SketchPicker, type RGBColor } from "react-color";

interface ColorPickerProps {
  onChange: (color: string) => void;
  color?: string;
  initialColor?: string;
}

const ColorPicker = ({color ,onChange, initialColor = "#ff0000" }: ColorPickerProps) => {

  const handleChange = (result: { hex: string; rgb: RGBColor }) => {
    onChange(result.hex);
  };

  return (
    <div className="flex justify-center w-full my-3">
      <SketchPicker
        color={color?? initialColor}
        onChange={handleChange}
      />
    </div>
  );
};

export default ColorPicker;
