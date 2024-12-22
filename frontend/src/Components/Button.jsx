export const Button = ({ label , onPress }) => {
    return (
      <div className="sm:py-2 sm:px-2 py-2 pl-0.5 pr-0">
        <button onClick={onPress} className="bg-gray-900 hover:bg-gray-800 text-white font-medium px-3 py-2 rounded-lg w-full h-1/2">
        {label}
      </button>
      </div>
    );
  };
  