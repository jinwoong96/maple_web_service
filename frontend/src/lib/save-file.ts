/** CSV를 **사용자가 정한 폴더**에 바로 저장한다.
 *
 * 브라우저는 웹페이지가 다운로드 경로를 정하지 못하게 막아 둔다. 대신 크롬·엣지의
 * 폴더 선택 API로 사용자가 폴더를 한 번 고르면, 그 폴더에 직접 쓸 수 있다.
 *
 * - **이 사이트에만 해당한다.** 권한은 사이트(origin)마다 따로 주어지고,
 *   브라우저의 다운로드 폴더 설정은 건드리지 않는다. 다른 사이트의 다운로드는
 *   그대로다.
 * - 고른 폴더 핸들은 IndexedDB에 남긴다(문자열로 바꿀 수 없어 localStorage엔
 *   못 넣는다). 브라우저를 다시 켜면 크롬이 처음 저장할 때 허용을 한 번 묻는다.
 * - 지원하지 않는 브라우저(파이어폭스·사파리)나 비보안 주소에서는 평소처럼
 *   내려받는다.
 */

import { downloadCsv } from '@/lib/csv'
import { idbDelete, idbGet, idbPut, STORES } from '@/lib/idb'

const FOLDER_KEY = 'score-csv-folder'

/** TS의 DOM 타입에 아직 없는 부분. 크롬·엣지에만 있다. */
interface PermissionedHandle extends FileSystemDirectoryHandle {
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
}

type DirectoryPicker = (options?: { mode?: 'readwrite'; id?: string }) => Promise<FileSystemDirectoryHandle>

function picker(): DirectoryPicker | null {
  const candidate = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker
  return typeof candidate === 'function' ? candidate : null
}

export function canPickFolder(): boolean {
  return window.isSecureContext && picker() !== null
}

export async function loadFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!canPickFolder()) return null
  try {
    return (await idbGet<FileSystemDirectoryHandle>(STORES.settings, FOLDER_KEY)) ?? null
  } catch {
    return null
  }
}

/** 폴더를 고른다. 사용자가 창을 닫으면 `null`. */
export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  const show = picker()
  if (!show) return null
  try {
    const handle = await show({ mode: 'readwrite', id: 'maple-log-scores' })
    await idbPut(STORES.settings, FOLDER_KEY, handle)
    return handle
  } catch {
    return null
  }
}

export async function forgetFolder(): Promise<void> {
  await idbDelete(STORES.settings, FOLDER_KEY)
}

/** 지금 그 폴더에 쓸 수 있는가. 묻지 않고 확인만 한다. */
export async function folderPermission(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  try {
    return await (handle as PermissionedHandle).queryPermission({ mode: 'readwrite' })
  } catch {
    return 'denied'
  }
}

/** 파일을 저장한다. 폴더가 있고 쓸 수 있으면 거기에, 아니면 평소처럼 내려받는다.
 *
 * 허용을 묻는 창은 **사용자가 누른 직후에만** 뜰 수 있으므로, 버튼 처리기에서
 * 곧바로 불러야 한다. 돌려주는 값으로 어디에 저장했는지 알린다. */
export async function saveCsvFile(
  folder: FileSystemDirectoryHandle | null,
  fileName: string,
  content: string,
): Promise<'folder' | 'download'> {
  if (folder) {
    try {
      const handle = folder as PermissionedHandle
      let permission = await handle.queryPermission({ mode: 'readwrite' })
      if (permission === 'prompt') permission = await handle.requestPermission({ mode: 'readwrite' })
      if (permission === 'granted') {
        const file = await folder.getFileHandle(fileName, { create: true })
        const writable = await file.createWritable()
        await writable.write(new Blob([content], { type: 'text/csv;charset=utf-8' }))
        await writable.close()
        return 'folder'
      }
    } catch {
      // 폴더가 지워졌거나 권한을 거절했다. 아래에서 평소대로 내려받는다.
    }
  }
  downloadCsv(fileName, content)
  return 'download'
}
