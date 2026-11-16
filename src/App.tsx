import { useEffect } from 'react'
import LibraryApp from './library/LibraryApp'
import { requestPersistentStorage } from './storage/persist'

function App() {
  useEffect(() => {
    requestPersistentStorage()
  }, [])

  return <LibraryApp />
}

export default App
