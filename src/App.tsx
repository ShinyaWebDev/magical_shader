import { Routes, Route } from "react-router-dom";
import Nav from "./components/Nav";
import Home from "./pages/Home";
import ShaderPlayground from "./pages/ShaderPlayground";
import PitchShaders from "./pages/PitchShaders";
import PitchVisualizer from "./PitchVisualizer";

export default function App() {
  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/pitch" element={<PitchVisualizer />} />
        <Route path="/shaders" element={<ShaderPlayground />} />
        <Route path="/pitch-shaders" element={<PitchShaders />} />
      </Routes>
    </>
  );
}
