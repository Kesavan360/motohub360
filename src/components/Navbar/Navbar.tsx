export default function Navbar() {
    return (
      <nav className="w-full border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <h1 className="text-2xl font-bold">MotoHub360</h1>
  
          <ul className="flex gap-8">
            <li><a href="/">Home</a></li>
            <li><a href="/cars">Cars</a></li>
            <li><a href="/bikes">Bikes</a></li>
            <li><a href="/about">About</a></li>
          </ul>
        </div>
      </nav>
    );
  }