import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Stack,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress
} from '@mui/material';
import { Delete, Refresh, Warning } from '@mui/icons-material';
import { db } from '../../../Api/api';
import { collection, getDocs, deleteDoc, doc, setDoc, getDoc } from 'firebase/firestore';

interface FirebaseCollection {
    id: string;
    name: string;
    documentCount: number;
}

export default function ZDeleteList() {
    const [collections, setCollections] = useState<FirebaseCollection[]>([]);
    const [selectedCollection, setSelectedCollection] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [confirmDialog, setConfirmDialog] = useState(false);

    useEffect(() => {
        // Don't load collections automatically on mount
        // User will click "Load Collections" button manually
    }, []);

    const loadCollections = async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log('🔍 Loading Firebase collections...');
            
            // Get collections list from my_collections/names document
            const namesDocRef = doc(db, 'my_collections', 'names');
            const namesDoc = await getDoc(namesDocRef);
            
            if (!namesDoc.exists()) {
                console.log('⚠️ No my_collections/names document found');
                setCollections([]);
                return;
            }

            const namesData = namesDoc.data();
            const collectionNames = namesData.names || [];
            
            console.log(`📊 Found ${collectionNames.length} collections:`, collectionNames);

            // Create collections list without document count (faster loading)
            const collectionsList = collectionNames.map((collectionName: string) => ({
                id: collectionName,
                name: collectionName,
                documentCount: 0 // We'll skip counting for faster loading
            }));

            setCollections(collectionsList);
            console.log(`✅ Loaded ${collectionsList.length} collections (fast mode)`);

        } catch (error) {
            console.error('❌ Error loading collections:', error);
            setError('שגיאה בטעינת רשימת הקולקשנים');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteCollection = async () => {
        if (!selectedCollection) {
            setError('בחר קולקשן למחיקה');
            return;
        }

        setIsDeleting(true);
        setError(null);
        setSuccess(null);

        try {
            console.log(`🗑️ Deleting collection: ${selectedCollection}`);
            
            // Get all documents in the collection
            const collectionRef = collection(db, selectedCollection);
            const snapshot = await getDocs(collectionRef);
            
            console.log(`📊 Found ${snapshot.size} documents in ${selectedCollection}`);
            
            // Delete all documents
            const deletePromises = snapshot.docs.map(docSnapshot => 
                deleteDoc(doc(db, selectedCollection, docSnapshot.id))
            );
            
            await Promise.all(deletePromises);
            
            console.log(`✅ Successfully deleted ${snapshot.size} documents from ${selectedCollection}`);
            
            // Update the collections list in my_collections/names
            const updatedCollections = collections.filter(c => c.name !== selectedCollection);
            const namesList = updatedCollections.map(c => c.name);
            
            // Update the names document
            await deleteDoc(doc(db, 'my_collections', 'names'));
            await setDoc(doc(db, 'my_collections', 'names'), {
                names: namesList,
                lastUpdated: new Date().toISOString()
            });
            
            setSuccess(`הקולקשן "${selectedCollection}" נמחק בהצלחה (${snapshot.size} מסמכים)`);
            setSelectedCollection('');
            
            // Refresh the collections list
            await loadCollections();
            
        } catch (error) {
            console.error(`❌ Error deleting collection ${selectedCollection}:`, error);
            setError(`שגיאה במחיקת הקולקשן "${selectedCollection}"`);
        } finally {
            setIsDeleting(false);
            setConfirmDialog(false);
        }
    };

    const handleConfirmDelete = () => {
        if (!selectedCollection) return;
        setConfirmDialog(true);
    };

    const handleCancelDelete = () => {
        setConfirmDialog(false);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                🗑️ מחיקת קולקשנים - ZDeleteList
            </Typography>
            
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        מחיקת קולקשן מהפיירבייס
                    </Typography>
                    
                    <Alert severity="info" sx={{ mb: 3 }}>
                        ⚠️ זה ימחק את כל המסמכים בקולקשן הנבחר. פעולה זו לא ניתנת לביטול!
                    </Alert>

                    {collections.length === 0 && !isLoading && (
                        <Alert severity="warning" sx={{ mb: 3 }}>
                            📋 לחץ על "טען רשימת קולקשנים" כדי לראות את כל הקולקשנים הזמינים
                        </Alert>
                    )}

                    <Stack spacing={3}>
                        <FormControl fullWidth>
                            <InputLabel>בחר קולקשן למחיקה</InputLabel>
                            <Select
                                value={selectedCollection}
                                onChange={(e) => setSelectedCollection(e.target.value)}
                                label="בחר קולקשן למחיקה"
                                disabled={isLoading || isDeleting}
                            >
                                {collections.map((collection) => (
                                    <MenuItem key={collection.id} value={collection.name}>
                                        {collection.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Stack direction="row" spacing={2}>
                            <Button
                                variant="outlined"
                                startIcon={<Refresh />}
                                onClick={loadCollections}
                                disabled={isLoading || isDeleting}
                                size="large"
                            >
                                {isLoading ? (
                                    <>
                                        <CircularProgress size={20} sx={{ mr: 1 }} />
                                        טוען...
                                    </>
                                ) : (
                                    'טען רשימת קולקשנים'
                                )}
                            </Button>

                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<Delete />}
                                onClick={handleConfirmDelete}
                                disabled={!selectedCollection || isLoading || isDeleting || collections.length === 0}
                                size="large"
                            >
                                {isDeleting ? (
                                    <>
                                        <CircularProgress size={20} sx={{ mr: 1 }} />
                                        מוחק...
                                    </>
                                ) : (
                                    'מחק קולקשן'
                                )}
                            </Button>
                        </Stack>

                        {error && (
                            <Alert severity="error">
                                {error}
                            </Alert>
                        )}

                        {success && (
                            <Alert severity="success">
                                {success}
                            </Alert>
                        )}
                    </Stack>
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        סטטיסטיקות
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary">
                        סה"כ קולקשנים: {collections.length}
                    </Typography>
                    
                    {collections.length > 0 && (
                        <Typography variant="body2" color="text.secondary">
                            💡 טעינה מהירה - מספר מסמכים לא מוצג
                        </Typography>
                    )}
                </CardContent>
            </Card>

            {/* Confirmation Dialog */}
            <Dialog open={confirmDialog} onClose={handleCancelDelete}>
                <DialogTitle>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <Warning color="error" />
                        <Typography>אישור מחיקה</Typography>
                    </Stack>
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        האם אתה בטוח שברצונך למחוק את הקולקשן "{selectedCollection}"?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        פעולה זו תמחק את כל המסמכים בקולקשן ולא ניתנת לביטול!
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancelDelete} disabled={isDeleting}>
                        ביטול
                    </Button>
                    <Button 
                        onClick={handleDeleteCollection} 
                        color="error" 
                        variant="contained"
                        disabled={isDeleting}
                        startIcon={isDeleting ? <CircularProgress size={20} /> : <Delete />}
                    >
                        {isDeleting ? 'מוחק...' : 'מחק'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}