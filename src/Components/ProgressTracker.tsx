import { Box, Typography, LinearProgress, Card, CardContent, Stack, Chip, Divider } from '@mui/material';
import { TrendingUp, CalendarToday, Assessment, CheckCircle, Error } from '@mui/icons-material';

interface AnalysisProgress {
    currentStep: string;
    currentDate: string;
    totalDates: number;
    completedDates: number;
    stepProgress: number;
    overallProgress: number;
    isRunning: boolean;
    error?: string;
}

interface ProgressTrackerProps {
    progress: AnalysisProgress;
}

export default function ProgressTracker({ progress }: ProgressTrackerProps) {
    const getStepIcon = (step: string) => {
        if (step.includes('AScan')) return '🔍';
        if (step.includes('BSpy')) return '📊';
        if (step.includes('CAtrPrice')) return '💰';
        if (step.includes('DSignals')) return '📈';
        if (step.includes('EAdx')) return '🎯';
        if (step.includes('Final')) return '🏆';
        return '⚙️';
    };

    const getStepColor = (step: string) => {
        if (step.includes('AScan')) return 'primary';
        if (step.includes('BSpy')) return 'secondary';
        if (step.includes('CAtrPrice')) return 'warning';
        if (step.includes('DSignals')) return 'info';
        if (step.includes('EAdx')) return 'success';
        if (step.includes('Final')) return 'error';
        return 'default';
    };

    const getStepName = (step: string) => {
        if (step.includes('AScan')) return 'AScan - סריקה ראשונית';
        if (step.includes('BSpy')) return 'BSpy - יחסית ל-SPY';
        if (step.includes('CAtrPrice')) return 'CAtrPrice - תנודתיות';
        if (step.includes('DSignals')) return 'DSignals - מומנטום';
        if (step.includes('EAdx')) return 'EAdx - חוזק מגמה';
        if (step.includes('Final')) return 'Final - חישוב סופי';
        return step;
    };

    return (
        <Card sx={{ mb: 3 }}>
            <CardContent>
                <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUp color="primary" />
                    מעקב התקדמות ניתוח
                </Typography>

                {/* סטטוס כללי */}
                <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                    <Chip 
                        icon={<CalendarToday />} 
                        label={`תאריך נוכחי: ${progress.currentDate || 'לא נבחר'}`}
                        color="primary" 
                        variant="outlined"
                    />
                    <Chip 
                        icon={<Assessment />} 
                        label={`${progress.completedDates}/${progress.totalDates} תאריכים`}
                        color="secondary" 
                        variant="outlined"
                    />
                    <Chip 
                        icon={progress.isRunning ? <TrendingUp /> : <CheckCircle />} 
                        label={progress.isRunning ? 'מתבצע' : 'הושלם'}
                        color={progress.isRunning ? 'warning' : 'success'}
                        variant="outlined"
                    />
                </Stack>

                {/* פרוגרס בר כללי */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        התקדמות כללית: {progress.overallProgress.toFixed(1)}%
                    </Typography>
                    <LinearProgress 
                        variant="determinate" 
                        value={progress.overallProgress} 
                        sx={{ height: 10, borderRadius: 5 }}
                    />
                </Box>

                {/* שלב נוכחי */}
                {progress.currentStep && (
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            שלב נוכחי: {getStepName(progress.currentStep)}
                        </Typography>
                        <LinearProgress 
                            variant="determinate" 
                            value={progress.stepProgress} 
                            sx={{ height: 8, borderRadius: 4 }}
                        />
                    </Box>
                )}

                {/* רשימת שלבים */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        שלבי הניתוח:
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        {['AScan', 'BSpy', 'CAtrPrice', 'DSignals', 'EAdx', 'Final'].map((step, index) => {
                            const isCompleted = progress.completedDates > 0 && index < 5;
                            const isCurrent = progress.currentStep.includes(step);
                            // const isPending = !isCompleted && !isCurrent;
                            
                            return (
                                <Chip
                                    key={step}
                                    icon={isCompleted ? <CheckCircle /> : <TrendingUp />}
                                    label={`${getStepIcon(step)} ${step}`}
                                    color={
                                        isCompleted ? 'success' :
                                        isCurrent ? getStepColor(step) as any :
                                        'default'
                                    }
                                    variant={isCompleted ? 'filled' : 'outlined'}
                                    size="small"
                                />
                            );
                        })}
                    </Stack>
                </Box>

                {/* הודעת שגיאה */}
                {progress.error && (
                    <Box sx={{ mt: 2 }}>
                        <Divider sx={{ mb: 2 }} />
                        <Typography 
                            variant="body2" 
                            color="error" 
                            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                        >
                            <Error fontSize="small" />
                            {progress.error}
                        </Typography>
                    </Box>
                )}

                {/* פרטים נוספים */}
                {progress.isRunning && (
                    <Box sx={{ mt: 2 }}>
                        <Divider sx={{ mb: 2 }} />
                        <Typography variant="caption" color="textSecondary">
                            💡 <strong>טיפ:</strong> הניתוח מתבצע ברצף. כל שלב נשמר ל-Firebase עם finalScore.
                            בסוף נוספים 5 ימים קדימה לכל מניה.
                        </Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
