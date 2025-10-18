import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  MessageSquare, 
  Users, 
  BarChart3, 
  Settings, 
  User,
  Bell,
  Search,
  Menu,
  LogOut,
  Shield
} from 'lucide-react';
import { Button } from './ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface LayoutProps {
  children: React.ReactNode;
  currentUser?: {
    name: string;
    role: string;
    avatar?: string;
  };
}

const getMenuItems = (userRole: string) => {
  const baseItems = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, href: '/chat' },
  ];

  const funnelItems = [
    { id: 'funnel-stage1', label: 'Funnel Stage 1', icon: BarChart3, href: '/funnel/stage1' },
    { id: 'funnel-stage2', label: 'Funnel Stage 2', icon: BarChart3, href: '/funnel/stage2' },
  ];

  const supervisorAndAdminOnlyItems = [
    { id: 'leads', label: 'Leads', icon: Users, href: '/leads' },
  ];

  const adminOnlyItems = [
    { id: 'users', label: 'User Management', icon: Shield, href: '/users' },
  ];

  const settingsItem = { id: 'settings', label: 'Settings', icon: Settings, href: '/settings' };

  if (userRole === 'admin') {
    return [...baseItems, ...supervisorAndAdminOnlyItems, ...funnelItems, ...adminOnlyItems, settingsItem];
  }

  if (userRole === 'supervisor') {
    return [...baseItems, ...supervisorAndAdminOnlyItems, ...funnelItems, settingsItem];
  }

  // Agent gets chat, funnel stages, and settings (NO leads access)
  return [...baseItems, ...funnelItems, settingsItem];
};

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentUser 
}) => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  
  const userToDisplay = currentUser || user || { name: 'Guest User', role: 'agent' };

  const handleLogout = React.useCallback(() => {
    logout();
    router.replace('/login');
  }, [logout, router]);

  const isActiveRoute = React.useCallback((href: string) => {
    return pathname === href;
  }, [pathname]);

  const memoizedMenuItems = React.useMemo(() => getMenuItems(userToDisplay.role), [userToDisplay.role]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-blue-900 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
        <div className="flex items-center justify-between h-16 px-4 bg-blue-950">
          <h1 className="text-xl font-bold text-white">Boztell CRM</h1>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-white hover:bg-blue-800"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </Button>
        </div>
        
        <nav className="flex-1 px-2 py-4 space-y-1">
          {memoizedMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActiveRoute(item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive 
                    ? 'bg-blue-800 text-white' 
                    : 'text-white hover:bg-blue-800'
                }`}
                prefetch={true}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="flex items-center px-4 py-4 border-t border-blue-800">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-blue-700 flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">{userToDisplay.name}</p>
              <p className="text-xs text-blue-200 capitalize">{userToDisplay.role}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden mr-2"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm">
                <Bell className="h-5 w-5" />
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
                <span className="ml-2 text-sm font-medium text-gray-700">{userToDisplay.name}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogout}
                  className="ml-2"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};