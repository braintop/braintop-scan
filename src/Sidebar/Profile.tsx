import { Box, List, ListItem, ListItemIcon, ListItemText, ListItemButton, Tooltip, IconButton, Divider, Collapse } from '@mui/material';
import { Person, ChevronLeft, ChevronRight, AccessTime, CalendarToday, CalendarViewWeek, CalendarMonth, ExpandLess, ExpandMore, Scanner, CloudDownload, Security, AttachMoney, SignalCellularAlt, Campaign, TrendingUp, Analytics, Delete, Assessment, Book, Timeline, QueryStats } from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';

interface ProfileProps {
    isCollapsed?: boolean;
    onToggle?: () => void;
}

export default function Profile({ isCollapsed = false, onToggle }: ProfileProps) {
    const location = useLocation();
    const [openDropdowns, setOpenDropdowns] = useState<{[key: string]: boolean}>({});

    const handleDropdownToggle = (dropdown: string) => {
        setOpenDropdowns(prev => ({
            ...prev,
            [dropdown]: !prev[dropdown]
        }));
    };

    const timeFrequencies = [
        {
            key: 'min5',
            icon: <QueryStats />,
            text: 'Min5',
            path: '/min5',
            components: [
                { icon: <QueryStats />, text: 'Dashboard', path: '/min5' }
            ]
        },
        {
            key: 'day1',
            icon: <TrendingUp />,
            text: 'Day1',
            path: '/day1',
            components: [
                { icon: <TrendingUp />, text: 'Dashboard', path: '/day1' }
            ]
        },
        {
            key: 'hourly',
            icon: <AccessTime />,
            text: 'Long Hourly',
            path: '/hourly',
            components: [
                { icon: <Scanner />, text: 'AScan', path: '/hourly/ascan' },
                { icon: <CloudDownload />, text: 'ACreateData', path: '/hourly/acreatedata' },
                { icon: <Security />, text: 'BSpy', path: '/hourly/bspy' },
                { icon: <AttachMoney />, text: 'CAtrPrice', path: '/hourly/catrprice' },
                { icon: <SignalCellularAlt />, text: 'DSignals', path: '/hourly/dsignals' },
                { icon: <Campaign />, text: 'EAdx', path: '/hourly/eadx' },
            ]
        },
        {
            key: 'daily',
            icon: <CalendarToday />,
            text: 'Long Daily',
            path: '/daily',
            components: [
                { icon: <Scanner />, text: 'AScan', path: '/daily/ascan' },
                { icon: <CloudDownload />, text: 'ACreateData', path: '/daily/acreatedata' },
                { icon: <Security />, text: 'BSpy', path: '/daily/bspy' },
                { icon: <AttachMoney />, text: 'CAtrPrice', path: '/daily/catrprice' },
                { icon: <SignalCellularAlt />, text: 'DSignals', path: '/daily/dsignals' },
                { icon: <Campaign />, text: 'EAdx', path: '/daily/eadx' },
                { icon: <TrendingUp />, text: 'Master Analysis', path: '/daily/master' },
                    { icon: <Assessment />, text: 'RR1', path: '/daily/rr1' },
                    { icon: <Book />, text: 'Trading Journal', path: '/daily/trading-journal' },
                    { icon: <Timeline />, text: 'After Trading Journal', path: '/daily/after-trading-journal' },
                    { icon: <Assessment />, text: 'Final Trading Journal', path: '/daily/final-trading-journal' },
                    { icon: <Delete />, text: 'Delete List', path: '/daily/deletelist' },
            ]
        },
        {
            key: 'weekly',
            icon: <CalendarViewWeek />,
            text: 'Long Weekly',
            path: '/weekly',
            components: [
                { icon: <Scanner />, text: 'AScan', path: '/weekly/ascan' },
                { icon: <CloudDownload />, text: 'ACreateData', path: '/weekly/acreatedata' },
                { icon: <Security />, text: 'BSpy', path: '/weekly/bspy' },
                { icon: <AttachMoney />, text: 'CAtrPrice', path: '/weekly/catrprice' },
                { icon: <SignalCellularAlt />, text: 'DSignals', path: '/weekly/dsignals' },
                { icon: <Campaign />, text: 'EAdx', path: '/weekly/eadx' },
                { icon: <Analytics />, text: 'MasterAnalysis', path: '/weekly/master' },
            ]
        },
        {
            key: 'monthly',
            icon: <CalendarMonth />,
            text: 'Long Monthly',
            path: '/monthly',
            components: [
                { icon: <Scanner />, text: 'AScan', path: '/monthly/ascan' },
                { icon: <CloudDownload />, text: 'ACreateData', path: '/monthly/acreatedata' },
                { icon: <Security />, text: 'BSpy', path: '/monthly/bspy' },
                { icon: <AttachMoney />, text: 'CAtrPrice', path: '/monthly/catrprice' },
                { icon: <SignalCellularAlt />, text: 'DSignals', path: '/monthly/dsignals' },
                { icon: <Campaign />, text: 'EAdx', path: '/monthly/eadx' },
            ]
        },
        {
            key: 'short_hourly',
            icon: <AccessTime />,
            text: 'Short Hourly',
            path: '/short/hourly',
            components: [
                { icon: <Security />, text: 'BSpy', path: '/short/hourly/bspy' },
                { icon: <AttachMoney />, text: 'CAtrPrice', path: '/short/hourly/catrprice' },
                { icon: <SignalCellularAlt />, text: 'DSignals', path: '/short/hourly/dsignals' },
                { icon: <Campaign />, text: 'EAdx', path: '/short/hourly/eadx' },
            ]
        },
        {
            key: 'short_daily',
            icon: <CalendarToday />,
            text: 'Short Daily',
            path: '/short/daily',
            components: [
                { icon: <Security />, text: 'BSpy', path: '/short/daily/bspy' },
                { icon: <AttachMoney />, text: 'CAtrPrice', path: '/short/daily/catrprice' },
                { icon: <SignalCellularAlt />, text: 'DSignals', path: '/short/daily/dsignals' },
                { icon: <Campaign />, text: 'EAdx', path: '/short/daily/eadx' },
                { icon: <TrendingUp />, text: 'Master Analysis', path: '/short/daily/master' },
            ]
        },
        {
            key: 'short_weekly',
            icon: <CalendarViewWeek />,
            text: 'Short Weekly',
            path: '/short/weekly',
            components: [
                { icon: <Scanner />, text: 'AScan', path: '/short/weekly/ascan' },
                { icon: <CloudDownload />, text: 'ACreateData', path: '/short/weekly/acreatedata' },
                { icon: <Security />, text: 'BSpy', path: '/short/weekly/bspy' },
                { icon: <AttachMoney />, text: 'CAtrPrice', path: '/short/weekly/catrprice' },
                { icon: <SignalCellularAlt />, text: 'DSignals', path: '/short/weekly/dsignals' },
                { icon: <Campaign />, text: 'EAdx', path: '/short/weekly/eadx' },
            ]
        },
        {
            key: 'short_monthly',
            icon: <CalendarMonth />,
            text: 'Short Monthly',
            path: '/short/monthly',
            components: [
                { icon: <Scanner />, text: 'AScan', path: '/short/monthly/ascan' },
                { icon: <CloudDownload />, text: 'ACreateData', path: '/short/monthly/acreatedata' },
                { icon: <Security />, text: 'BSpy', path: '/short/monthly/bspy' },
                { icon: <AttachMoney />, text: 'CAtrPrice', path: '/short/monthly/catrprice' },
                { icon: <SignalCellularAlt />, text: 'DSignals', path: '/short/monthly/dsignals' },
                { icon: <Campaign />, text: 'EAdx', path: '/short/monthly/eadx' },
            ]
        }
    ];

    return (
        <Box sx={{ mt: 8 }}>
            {/* Togonet gle Button */}
            <Box sx={{ display: 'flex', justifyContent: isCollapsed ? 'center' : 'flex-end', p: 1 }}>
                {onToggle && (
                    <Tooltip title={isCollapsed ? "Open Menu" : "Close Menu"} placement="right">
                        <IconButton 
                            onClick={onToggle}
                            size="small"
                            sx={{ 
                                color: 'primary.main',
                                '&:hover': { backgroundColor: 'primary.light', color: 'white' }
                            }}
                        >
                            {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
                        </IconButton>
                    </Tooltip>
                )}
            </Box>
            <Divider sx={{ mb: 1 }} />
            <List>
                {/* Profile */}
                <ListItem disablePadding>
                    {isCollapsed ? (
                        <Tooltip title="Profile" placement="right">
                            <ListItemButton 
                                component={Link} 
                                to="/profile"
                                selected={location.pathname === "/profile"}
                                sx={{
                                    minHeight: 48,
                                    justifyContent: 'center',
                                    px: 2.5,
                                }}
                            >
                                <ListItemIcon
                                    sx={{
                                        minWidth: 0,
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Person />
                                </ListItemIcon>
                            </ListItemButton>
                        </Tooltip>
                    ) : (
                        <ListItemButton 
                            component={Link} 
                            to="/profile"
                            selected={location.pathname === "/profile"}
                        >
                            <ListItemIcon>
                                <Person />
                            </ListItemIcon>
                            <ListItemText primary="Profile" />
                        </ListItemButton>
                    )}
                </ListItem>

                {/* Time Frequencies with Dropdowns */}
                {timeFrequencies.map((frequency) => {
                    // Determine background color based on Long/Short
                    const isLong = frequency.text.startsWith('Long');
                    const isShort = frequency.text.startsWith('Short');
                    
                    const backgroundColor = isLong ? 'rgba(76, 175, 80, 0.1)' : 
                                          isShort ? 'rgba(244, 67, 54, 0.1)' : 
                                          'transparent';
                    
                    return (
                        <Box key={frequency.key} sx={{ backgroundColor }}>
                            <ListItem disablePadding>
                                {isCollapsed ? (
                                    <Tooltip title={frequency.text} placement="right">
                                        <ListItemButton 
                                            component={Link} 
                                            to={frequency.path}
                                            selected={location.pathname.startsWith(frequency.path)}
                                            sx={{
                                                minHeight: 48,
                                                justifyContent: 'center',
                                                px: 2.5,
                                            }}
                                        >
                                            <ListItemIcon
                                                sx={{
                                                    minWidth: 0,
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                {frequency.icon}
                                            </ListItemIcon>
                                        </ListItemButton>
                                    </Tooltip>
                                ) : (
                                    <ListItemButton 
                                        onClick={() => handleDropdownToggle(frequency.key)}
                                        selected={location.pathname.startsWith(frequency.path)}
                                    >
                                        <ListItemIcon>
                                            {frequency.icon}
                                        </ListItemIcon>
                                        <ListItemText primary={frequency.text} />
                                        {openDropdowns[frequency.key] ? <ExpandLess /> : <ExpandMore />}
                                    </ListItemButton>
                                )}
                            </ListItem>
                        
                        {/* Dropdown Components */}
                        {!isCollapsed && (
                            <Collapse in={openDropdowns[frequency.key]} timeout="auto" unmountOnExit>
                                <List component="div" disablePadding>
                                    {frequency.components.map((component) => (
                                        <ListItem key={component.path} disablePadding>
                                            <ListItemButton 
                                                component={Link} 
                                                to={component.path}
                                                selected={location.pathname === component.path}
                                                sx={{ pl: 4 }}
                                            >
                                                <ListItemIcon>
                                                    {component.icon}
                                                </ListItemIcon>
                                                <ListItemText primary={component.text} />
                                            </ListItemButton>
                                        </ListItem>
                                    ))}
                                </List>
                            </Collapse>
                        )}
                        </Box>
                    );
                })}
            </List>
        </Box>
    );
}
