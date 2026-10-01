import NoticesCard from './NoticesCard'

// The full board: every notice and task, with the form to add more.
export default function NoticesPage() {
  return (
    <main className="td">
      <header className="page-head">
        <div className="page-head__main">
          <h1 className="page-title">Avisos y tareas</h1>
        </div>
      </header>
      <NoticesCard />
    </main>
  )
}
