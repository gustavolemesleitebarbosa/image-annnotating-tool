import React  from 'react';
import Select, { 
  type StylesConfig, 
  type GroupBase, 
  type CSSObjectWithLabel,
  components,
  type SingleValue,
} from 'react-select';
import { type Class } from '~/Types/Class';


// Custom Option Component
const CustomOption = ({ children, ...props }: Class) => {
  return (
    <components.Option {...props}>
      <div className="flex justify-between items-center">
        <span className="w-4/5">{props.data.name}</span>
        <div
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: props.data.color }}
        ></div>
      </div>
    </components.Option>
  );
};

// Custom SingleValue Component
const CustomSingleValue = ({ children, ...props }: any) => {
  return (
    <components.SingleValue {...props}>
      <div className="flex justify-between items-center">
        <span>{props.data.name}</span>
        <div
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: props.data.color }}
        ></div>
      </div>
    </components.SingleValue>
  );
};

// Main Component
const ClassPicker = ({ classes, onClassSelect, selectedClass }: { classes: Class[], onClassSelect?: (selectedClass: Class | null) => void, selectedClass: Class | null }) => {

  const customStyles: StylesConfig<Class, false, GroupBase<Class>> = {
    control: (baseStyles: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...baseStyles,
      border: '1px solid #ccc',
      fontSize: '14px',
      padding: '0.5rem',
      borderRadius: '4px',
    }),
    menu: (baseStyles: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...baseStyles,
      marginTop: '5px',
      border: '1px solid #ccc', 
      borderRadius: '4px',
      fontSize: '14px',

      backgroundColor: 'white',
      maxHeight: '150px',
    }),
    option: (baseStyles: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...baseStyles,
      cursor: 'pointer',
      whiteSpace: 'normal', 
      wordBreak: 'break-word',
      fontSize: '14px',
      '&:hover': {
        backgroundColor: '#f0f0f0',
      },
    }),
    menuList: (baseStyles: CSSObjectWithLabel): CSSObjectWithLabel => ({
      ...baseStyles,
      maxHeight: '150px',
      fontSize: '14px',

      overflowY: 'auto'
    })
  };

  const handleChange = (
    newValue: SingleValue<Class>,
  ) => {
    if (onClassSelect) {
      onClassSelect(newValue);
    }
  };

  return (
    <Select<Class>
      options={classes}
      value={selectedClass}
      onChange={handleChange}
      styles={customStyles}
      components={{ 
        Option: CustomOption,
        SingleValue: CustomSingleValue
      }}
      placeholder="Select a class"
      getOptionLabel={(option: Class) => option.name}
      getOptionValue={(option: Class) => option.id.toString()}
      isClearable={false}
    />
  );
};

export default ClassPicker;
