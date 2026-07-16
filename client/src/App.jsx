import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import DriverPage from "./pages/DriverPage";
import RiderPage from "./pages/RiderPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/driver" element={<DriverPage />} />
        <Route path="/rider" element={<RiderPage />} />
        <Route path="/rider/:code" element={<RiderPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
