import ColorPalette from "./components/ColorPalette";

export default function Home() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white text-gray-900 dark:bg-black dark:text-white">
      <main className="w-full max-w-[1400px] mx-auto py-12 px-4">
        <h1 className="flex items-center justify-center text-4xl font-bold text-gray-900 dark:text-white mb-[32px]">
          OKLCH Color Palette Generator
        </h1>
        <ColorPalette />
      </main>
    </div>
  );
}
