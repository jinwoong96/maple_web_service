interface ToggleGroupProps<T extends string | number> {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
  label: (value: T) => string
}

/** 계산기 곳곳의 "둘 중 하나 고르기" 버튼 묶음. */
export function ToggleGroup<T extends string | number>({ options, value, onChange, label }: ToggleGroupProps<T>) {
  return (
    <div className="flex rounded-lg border p-0.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === option ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
          }`}
        >
          {label(option)}
        </button>
      ))}
    </div>
  )
}
