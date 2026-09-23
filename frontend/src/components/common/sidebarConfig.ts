import React from 'react';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Wallet,
  User,
  ShoppingCart,
  Building2,
  Package,
  Inbox,
  BarChart3,
  Truck,
  DollarSign,
  Tag,
  FileText,
  LifeBuoy,
  Settings,
  CalendarDays,
  Plus,
  Gift,
  ShoppingBag,
  MapPin,
} from 'lucide-react';

export interface SidebarNavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  badge?: number | string;
  badgeVariant?: 'default' | 'rose' | 'amber';
}

export interface SidebarNavSection {
  title: string;
  items: SidebarNavItem[];
}

export interface PortalSidebarConfig {
  portalKey: string;
  portalLabel: string;
  homePath: string;
  profilePath: string;
  sections: SidebarNavSection[];
}

export interface DynamicBadges {
  [key: string]: number | string | undefined;
}

/**
 * Returns the standardized portal navigation configuration for a given role or portal identifier.
 */
export function getPortalSidebarConfig(
  roleOrKey?: string,
  badges?: DynamicBadges
): PortalSidebarConfig {
  const normalizedKey = (roleOrKey || '').toUpperCase().replace(/[- ]/g, '_');

  switch (normalizedKey) {
    case 'DELIVERY_PARTNER':
      return {
        portalKey: 'delivery-partner',
        portalLabel: 'DELIVERY PARTNER',
        homePath: '/delivery-partner',
        profilePath: '/delivery-partner/profile',
        sections: [
          {
            title: 'OVERVIEW',
            items: [
              {
                to: '/delivery-partner',
                label: 'Overview',
                icon: LayoutDashboard,
                end: true,
                badge: badges?.tasksCount ?? badges?.['/delivery-partner'],
              },
            ],
          },
          {
            title: 'OPERATIONS',
            items: [
              {
                to: '/delivery-partner/customers',
                label: 'Customers',
                icon: Users,
              },
              {
                to: '/delivery-partner/orders',
                label: 'Orders',
                icon: ClipboardList,
              },
            ],
          },
          {
            title: 'FINANCE',
            items: [
              {
                to: '/delivery-partner/profits',
                label: 'Profits',
                icon: Wallet,
              },
            ],
          },
          {
            title: 'ACCOUNT',
            items: [
              {
                to: '/delivery-partner/profile',
                label: 'Profile',
                icon: User,
              },
            ],
          },
        ],
      };

    case 'DISTRIBUTOR':
      return {
        portalKey: 'distributor',
        portalLabel: 'DISTRIBUTOR',
        homePath: '/distributor/orders',
        profilePath: '/distributor/settings',
        sections: [
          {
            title: 'OVERVIEW',
            items: [
              {
                to: '/distributor/new-orders',
                label: 'New Orders',
                icon: Inbox,
                badge: badges?.newOrdersCount ?? badges?.['/distributor/new-orders'],
                badgeVariant: 'rose',
              },
              {
                to: '/distributor/orders',
                label: 'Orders',
                icon: Package,
              },
            ],
          },
          {
            title: 'PROCUREMENT',
            items: [
              {
                to: '/distributor/purchases',
                label: 'Purchases',
                icon: ShoppingCart,
              },
              {
                to: '/distributor/suppliers',
                label: 'Suppliers',
                icon: Building2,
              },
            ],
          },
          {
            title: 'FINANCE & REPORTS',
            items: [
              {
                to: '/distributor/wallet',
                label: 'Wallet',
                icon: Wallet,
              },
              {
                to: '/distributor/reports',
                label: 'Reports',
                icon: BarChart3,
              },
            ],
          },
          {
            title: 'OPERATIONS',
            items: [
              {
                to: '/distributor/service-areas',
                label: 'Service Areas',
                icon: MapPin,
              },
              {
                to: '/distributor/settings',
                label: 'Settings',
                icon: Settings,
              },
            ],
          },
        ],
      };

    case 'SUPER_ADMIN':
    case 'ADMIN':
      return {
        portalKey: 'admin',
        portalLabel: normalizedKey === 'SUPER_ADMIN' ? 'SUPER ADMIN' : 'ADMIN',
        homePath: '/admin/dashboard',
        profilePath: '/admin/profile',
        sections: [
          {
            title: 'MAIN',
            items: [
              {
                to: '/admin/dashboard',
                label: 'Dashboard',
                icon: LayoutDashboard,
                end: true,
              },
              {
                to: '/admin/catalog',
                label: 'Catalog',
                icon: Package,
              },
              {
                to: '/admin/operations',
                label: 'Operations',
                icon: Truck,
              },
              {
                to: '/admin/orders',
                label: 'Orders',
                icon: ShoppingCart,
              },
              {
                to: '/admin/finance',
                label: 'Finance',
                icon: DollarSign,
              },
            ],
          },
          {
            title: 'MANAGEMENT',
            items: [
              {
                to: '/admin/customers',
                label: 'Customers',
                icon: Users,
              },
              {
                to: '/admin/delivery-partners',
                label: 'Delivery Partners',
                icon: Truck,
              },
              {
                to: '/admin/users',
                label: 'Users & Staff',
                icon: Users,
              },
              {
                to: '/admin/promos',
                label: 'Promo Codes',
                icon: Tag,
              },
              {
                to: '/admin/reports',
                label: 'Reports',
                icon: FileText,
              },
            ],
          },
          {
            title: 'SUPPORT',
            items: [
              {
                to: '/admin/support',
                label: 'Support',
                icon: LifeBuoy,
              },
              {
                to: '/admin/settings',
                label: 'Settings',
                icon: Settings,
              },
              {
                to: '/admin/profile',
                label: 'Profile',
                icon: User,
              },
            ],
          },
        ],
      };

    case 'STAFF':
    case 'MANAGER':
    case 'OPERATOR':
      return {
        portalKey: 'staff',
        portalLabel: normalizedKey === 'MANAGER' ? 'MANAGER' : normalizedKey === 'OPERATOR' ? 'OPERATOR' : 'STAFF',
        homePath: '/staff/operations',
        profilePath: '/staff/profile',
        sections: [
          {
            title: 'OPERATIONS',
            items: [
              {
                to: '/staff/operations',
                label: 'Route Operations',
                icon: Truck,
                end: true,
              },
              {
                to: '/staff/orders',
                label: 'Orders',
                icon: ShoppingCart,
              },
              {
                to: '/staff/customers',
                label: 'Customers',
                icon: Users,
              },
            ],
          },
          {
            title: 'INVENTORY',
            items: [
              {
                to: '/staff/packages',
                label: 'Packages',
                icon: Package,
              },
              {
                to: '/staff/inventory',
                label: 'Inventory',
                icon: ClipboardList,
              },
            ],
          },
          {
            title: 'ACCOUNT',
            items: [
              {
                to: '/staff/support',
                label: 'Support',
                icon: LifeBuoy,
              },
              {
                to: '/staff/profile',
                label: 'Profile',
                icon: User,
              },
            ],
          },
        ],
      };

    case 'CUSTOMER':
      return {
        portalKey: 'customer',
        portalLabel: 'CUSTOMER',
        homePath: '/customer/shop',
        profilePath: '/customer/profile',
        sections: [
          {
            title: 'SHOP & ORDERS',
            items: [
              {
                to: '/customer/shop',
                label: 'Shop',
                icon: ShoppingBag,
                end: true,
              },
              {
                to: '/customer/orders',
                label: 'My Orders',
                icon: Package,
                badge: badges?.activeOrdersCount ?? badges?.['/customer/orders'],
              },
              {
                to: '/customer/schedule',
                label: 'Schedule',
                icon: CalendarDays,
              },
              {
                to: '/customer/deliveries',
                label: 'Deliveries',
                icon: Truck,
              },
            ],
          },
          {
            title: 'WALLET & REWARDS',
            items: [
              {
                to: '/customer/wallet',
                label: 'Wallet',
                icon: Wallet,
              },
              {
                to: '/customer/recharge',
                label: 'Recharge',
                icon: Plus,
              },
              {
                to: '/customer/referrals',
                label: 'Referrals',
                icon: Gift,
              },
            ],
          },
          {
            title: 'ACCOUNT',
            items: [
              {
                to: '/customer/dashboard',
                label: 'Dashboard',
                icon: LayoutDashboard,
              },
              {
                to: '/customer/profile',
                label: 'Profile',
                icon: User,
              },
              {
                to: '/customer/support',
                label: 'Support',
                icon: LifeBuoy,
              },
            ],
          },
        ],
      };

    default:
      return {
        portalKey: (roleOrKey || 'app').toLowerCase(),
        portalLabel: (roleOrKey || 'PORTAL').toUpperCase(),
        homePath: '/',
        profilePath: '/profile',
        sections: [],
      };
  }
}
