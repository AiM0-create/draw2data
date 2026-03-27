import { DATASETS } from '../../core/datasets';

interface DatasetSelectorProps {
  selected: string[];
  onChange: (datasets: string[]) => void;
}

export function DatasetSelector({ selected, onChange }: DatasetSelectorProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((d) => d !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-2">
      {DATASETS.map((dataset) => (
        <label
          key={dataset.id}
          className="flex items-start gap-2 cursor-pointer group"
        >
          <input
            type="checkbox"
            checked={selected.includes(dataset.id)}
            onChange={() => toggle(dataset.id)}
            className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <span className="text-sm text-gray-800 group-hover:text-blue-600">
              {dataset.name}
            </span>
            <p className="text-xs text-gray-400">{dataset.description}</p>
          </div>
        </label>
      ))}
    </div>
  );
}
