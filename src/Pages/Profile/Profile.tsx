import { Box, Typography, Paper, List, ListItem, ListItemText, Avatar } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';

export default function Profile() {
    return (
        <Box sx={{ p: 3 }}>
            <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 64, height: 64 }}>
                        <PersonIcon fontSize="large" />
                    </Avatar>
                    <Box>
                        <Typography variant="h4" component="h1" gutterBottom>
                            פרופיל משתמש
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary">
                            ברוכים הבאים למערכת BrainTop
                        </Typography>
                    </Box>
                </Box>

                <List>
                    <ListItem>
                        <ListItemText
                            primary="אודות המערכת"
                            secondary="מערכת לניתוח נתוני מניות וסטטיסטיקות מסחר"
                        />
                    </ListItem>
                    <ListItem>
                        <ListItemText
                            primary="תכונות זמינות"
                            secondary="ניתוח יומי, סטטיסטיקות שבועיות, ומעקב אחר ביצועים"
                        />
                    </ListItem>
                    <ListItem>
                        <ListItemText
                            primary="ניווט"
                            secondary="השתמש בתפריט הצד כדי לנווט בין הדפים השונים"
                        />
                    </ListItem>
                </List>

                <Box sx={{ mt: 4, p: 2, bgcolor: 'primary.light', borderRadius: 1 }}>
                    <Typography variant="body2" color="primary.contrastText" align="center">
                        💡 טיפ: לחץ על הכפתור בחלק העליון של התפריט הצד כדי לקפל או לפתוח אותו
                    </Typography>
                </Box>
            </Paper>
        </Box>
    );
}
