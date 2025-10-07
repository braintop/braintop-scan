import { useState, useEffect } from 'react';
import {
    AppBar,
    Box,
    CssBaseline,
    Drawer,
    IconButton,
    Toolbar,
    Typography,
    Button,
    useTheme
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import { Outlet, useNavigate } from 'react-router-dom';
import Profile from '../Sidebar/Profile';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';

const drawerWidth = 240;
const miniDrawerWidth = 64;

export default function Layout() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const theme = useTheme();
    const navigate = useNavigate();

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser);
        });
        return () => unsubscribe();
    }, []);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleDrawerOpen = () => {
        setIsDrawerOpen(true);
    };

    const handleDrawerClose = () => {
        setIsDrawerOpen(false);
    };

    const handleLogout = async () => {
        const auth = getAuth();
        await signOut(auth);
        navigate('/login');
    };

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />
            <AppBar
                position="fixed"
                sx={{
                    width: { sm: `calc(100% - ${isDrawerOpen ? drawerWidth : miniDrawerWidth}px)` },
                    ml: { sm: `${isDrawerOpen ? drawerWidth : miniDrawerWidth}px` },
                    transition: theme.transitions.create(['margin', 'width'], {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.leavingScreen,
                    }),
                }}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={handleDrawerToggle}
                        sx={{ mr: 2, display: { sm: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <IconButton
                        color="inherit"
                        aria-label="toggle drawer"
                        edge="start"
                        onClick={isDrawerOpen ? handleDrawerClose : handleDrawerOpen}
                        sx={{ mr: 2 }}
                    >
                        {isDrawerOpen ? <ChevronLeftIcon /> : <MenuIcon />}
                    </IconButton>
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        BrainTop
                    </Typography>
                    <Button color="inherit" onClick={() => navigate('/home')}>Home</Button>
                    {!user && <Button color="inherit" onClick={() => navigate('/login')}>Login</Button>}
                    {!user && <Button color="inherit" onClick={() => navigate('/register')}>Register</Button>}
                    <Button color="inherit" onClick={() => navigate('/about')}>About</Button>
                    {user && <Button color="inherit" onClick={handleLogout}>Logout</Button>}
                </Toolbar>
            </AppBar>
            <Box
                component="nav"
                sx={{ width: { sm: isDrawerOpen ? drawerWidth : miniDrawerWidth }, flexShrink: { sm: 0 } }}
            >
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{
                        keepMounted: true,
                    }}
                    sx={{
                        display: { xs: 'block', sm: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                >
                    <Profile onToggle={handleDrawerToggle} />
                </Drawer>
                <Drawer
                    variant="persistent"
                    open
                    sx={{
                        display: { xs: 'none', sm: 'block' },
                        '& .MuiDrawer-paper': {
                            boxSizing: 'border-box',
                            width: isDrawerOpen ? drawerWidth : miniDrawerWidth,
                            transition: theme.transitions.create('width', {
                                easing: theme.transitions.easing.sharp,
                                duration: theme.transitions.duration.enteringScreen,
                            }),
                            overflowX: 'hidden',
                        },
                    }}
                >
                    <Profile 
                        isCollapsed={!isDrawerOpen} 
                        onToggle={isDrawerOpen ? handleDrawerClose : handleDrawerOpen}
                    />
                </Drawer>
            </Box>
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 0,
                    pt: '64px',
                    mt: 0,
                    width: { sm: isDrawerOpen ? `calc(100% - ${drawerWidth}px)` : `calc(100% - ${miniDrawerWidth}px)` },
                    ml: { sm: isDrawerOpen ? `${drawerWidth}px` : `${miniDrawerWidth}px` },
                    transition: theme.transitions.create(['margin', 'width'], {
                        easing: theme.transitions.easing.sharp,
                        duration: theme.transitions.duration.leavingScreen,
                    }),
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
}
