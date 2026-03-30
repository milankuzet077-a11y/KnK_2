import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './app/App'
import './styles.css'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import './ui/layoutFix.css'
import { syncPwaRuntimeForCurrentBuild } from './pwa/runtime'

const ElementDetailsPage = React.lazy(() => import('./ui/ElementDetailsPage').then((m) => ({ default: m.ElementDetailsPage })))

void syncPwaRuntimeForCurrentBuild()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/*
      React Router v6 "future" flags:
      - v7_startTransition: opt-in to wrapping navigations in startTransition (v7 default)
      - v7_relativeSplatPath: opt-in to updated splat relative path resolution (v7 default)
      These remove console warnings and should not change visible UX.
    */}
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route
          path="/"
          element={
            <>
              {/* App je uvek montiran, da se scena/konfiguracija NE resetuje kad otvorimo detalje */}
              <App />
              <Outlet />
            </>
          }
        >
          {/* "index" ne renderuje ništa u Outlet-u */}
          <Route index element={null} />
          {/* Detalji se renderuju kao overlay iznad konfiguratora */}
          <Route
            path="element/:id"
            element={
              <Suspense fallback={null}>
                <ElementDetailsPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
