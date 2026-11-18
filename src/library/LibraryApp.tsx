import { useState } from 'react'
import HomeScreen from './HomeScreen'
import FolderScreen from './FolderScreen'
import NotebookScreen from './NotebookScreen'
import TrashScreen from './TrashScreen'
import PageScreen from './PageScreen'
import SettingsScreen from './SettingsScreen'

type Route =
  | { screen: 'home' }
  | { screen: 'folder'; folderId: string }
  | { screen: 'notebook'; notebookId: string; folderId: string | null }
  | { screen: 'trash' }
  | { screen: 'page'; pageId: string; notebookId: string; folderId: string | null }
  | { screen: 'settings' }

/**
 * Top-level library navigation. No router library: the app's navigation is
 * shallow (home > folder > notebook > page, plus a trash screen), so a
 * single piece of state is simpler than wiring up a router for Phase 1A.
 */
export default function LibraryApp() {
  const [route, setRoute] = useState<Route>({ screen: 'home' })

  switch (route.screen) {
    case 'home':
      return (
        <HomeScreen
          onOpenFolder={(folderId) => setRoute({ screen: 'folder', folderId })}
          onOpenNotebook={(notebookId, folderId) => setRoute({ screen: 'notebook', notebookId, folderId })}
          onOpenTrash={() => setRoute({ screen: 'trash' })}
          onOpenSettings={() => setRoute({ screen: 'settings' })}
        />
      )
    case 'folder':
      return (
        <FolderScreen
          folderId={route.folderId}
          onBack={() => setRoute({ screen: 'home' })}
          onOpenNotebook={(notebookId) => setRoute({ screen: 'notebook', notebookId, folderId: route.folderId })}
        />
      )
    case 'notebook':
      return (
        <NotebookScreen
          notebookId={route.notebookId}
          onBack={() =>
            setRoute(route.folderId ? { screen: 'folder', folderId: route.folderId } : { screen: 'home' })
          }
          onOpenPage={(pageId) =>
            setRoute({ screen: 'page', pageId, notebookId: route.notebookId, folderId: route.folderId })
          }
        />
      )
    case 'trash':
      return <TrashScreen onBack={() => setRoute({ screen: 'home' })} />
    case 'settings':
      return <SettingsScreen onBack={() => setRoute({ screen: 'home' })} />
    case 'page':
      return (
        <PageScreen
          pageId={route.pageId}
          notebookId={route.notebookId}
          onBack={() => setRoute({ screen: 'notebook', notebookId: route.notebookId, folderId: route.folderId })}
          onNavigatePage={(pageId) => setRoute({ screen: 'page', pageId, notebookId: route.notebookId, folderId: route.folderId })}
        />
      )
  }
}
