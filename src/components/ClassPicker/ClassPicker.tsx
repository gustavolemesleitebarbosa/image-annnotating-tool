import React, { useState, useEffect, useRef } from "react";
import Select, {
  type StylesConfig,
  type GroupBase,
  type CSSObjectWithLabel,
  components,
  type SingleValue,
  type OptionProps,
} from "react-select";
import { type Class } from "~/Types/Class";

const CustomOption = (props: {data: Class} & OptionProps<Class, false, GroupBase<Class>>) => (
  <components.Option {...props}>
    <div className="flex justify-between items-center">
      <span className="w-4/5">{props.data.name}</span>
      <div
        className="h-4 w-4 rounded-full"
        style={{ backgroundColor: props.data.color }}
      />
    </div>
  </components.Option>
);

const CustomSingleValue =  (props: {data: Class} & OptionProps<Class, false, GroupBase<Class>>) => (
  <components.SingleValue {...props}>
    <div className="flex justify-between items-center">
      <span>{props.data.name}</span>
      <div
        className="h-4 w-4 rounded-full"
        style={{ backgroundColor: props.data.color }}
      />
    </div>
  </components.SingleValue>
);

const ClassPicker = ({
  classes,
  onClassSelect,
  selectedClass,
}: {
  classes: Class[];
  onClassSelect?: (selectedClass: Class | null) => void;
  selectedClass: Class | null;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const customStyles: StylesConfig<Class, false, GroupBase<Class>> = {
    control: (baseStyles: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...baseStyles,
      border: "1px solid #ccc",
      fontSize: "14px",
      padding: "0.3rem",
      borderRadius: "4px",
    }),
    menu: (baseStyles: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...baseStyles,
      marginTop: "5px",
      border: "1px solid #ccc",
      borderRadius: "4px",
      fontSize: "14px",
      backgroundColor: "white",
      maxHeight: "150px",
    }),
    option: (baseStyles: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...baseStyles,
      cursor: "pointer",
      whiteSpace: "normal",
      wordBreak: "break-word",
      fontSize: "14px",
      "&:hover": {
        backgroundColor: "#f0f0f0",
      },
    }),
    menuList: (baseStyles: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...baseStyles,
      maxHeight: "150px",
      fontSize: "14px",
      overflowY: "auto",
    }),
  };

  const handleChange = (newValue: SingleValue<Class>) => {
    if (onClassSelect) {
      onClassSelect(newValue);
    }
    setMenuOpen(false);
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        className="w-full border border-gray-300 p-2 rounded bg-white flex justify-between items-center"
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        <span>{selectedClass ? selectedClass.name : "Select a class"}</span>
        <div
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: selectedClass?.color ?? "transparent" }}
        />
      </button>
      {menuOpen && (
        <div className="absolute w-full mt-2 z-50">
          <Select<Class>
            options={classes}
            value={selectedClass}
            onChange={handleChange}
            styles={customStyles}
            components={{
              Option: CustomOption,
              SingleValue: CustomSingleValue,
            }}
            placeholder="Select a class"
            getOptionLabel={(option: Class) => option.name}
            getOptionValue={(option: Class) => option.id.toString()}
            isClearable={false}
            menuIsOpen
          />
        </div>
      )}
    </div>
  );
};

export default ClassPicker;
