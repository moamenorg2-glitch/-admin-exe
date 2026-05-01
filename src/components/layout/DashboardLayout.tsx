import { ReactNode, useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  const toggleDarkMode = () => {
    setIsDarkMode((prev: boolean) => {
      const newValue = !prev;
      localStorage.setItem('darkMode', JSON.stringify(newValue));
      if (newValue) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return newValue;
    });
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  return (
    <div className={cn(
      "flex flex-col h-screen overflow-hidden transition-colors duration-300",
      isDarkMode ? "bg-[#151521]" : "bg-[#F3F6F9]"
    )}>
      <Header 
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} 
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isCollapsed={isSidebarCollapsed}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar 
          isOpen={isSidebarOpen} 
          isCollapsed={isSidebarCollapsed}
          onClose={() => setIsSidebarOpen(false)} 
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex-1 h-full min-h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
