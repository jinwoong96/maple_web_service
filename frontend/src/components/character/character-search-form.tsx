import { Search } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Input } from '@/components/ui/input'

interface CharacterSearchFormProps {
  onSubmit: (characterName: string) => void
  placeholder?: string
  /** 제출하면 입력칸을 비운다. 포커스는 그대로 두므로 여러 개를 연달아
   * 입력할 수 있다 — `key`를 바꿔 다시 마운트하는 방식은 포커스를 잃는다. */
  resetOnSubmit?: boolean
}

export function CharacterSearchForm({
  onSubmit,
  placeholder = '캐릭터 이름을 입력하세요',
  resetOnSubmit = false,
}: CharacterSearchFormProps) {
  const [value, setValue] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit(value.trim())
    if (resetOnSubmit) setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative w-full">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
    </form>
  )
}
