import { Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Today } from "./views/Today";
import { Inbox } from "./views/Inbox";
import { Planner } from "./views/Planner";
import { Review } from "./views/Review";
import { Settings } from "./views/Settings";
import { CaptureProvider } from "./components/CaptureProvider";

export default function App() {
  return (
    <CaptureProvider>
      <div className="flex h-full flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/today" replace />} />
              <Route path="/today" element={<Today />} />
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/planner" element={<Planner />} />
              <Route path="/review" element={<Review />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </CaptureProvider>
  );
}
