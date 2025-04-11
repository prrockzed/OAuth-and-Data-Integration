import { useState } from 'react';
import {
    Box,
    TextField,
    Button,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Tabs,
    Tab,
    CircularProgress
} from '@mui/material';
import axios from 'axios';

const endpointMapping = {
    'Notion': 'notion',
    'Airtable': 'airtable',
    'Hubspot': 'hubspot',
};

export const DataForm = ({ integrationType, credentials }) => {
    const [loadedData, setLoadedData] = useState(null);
    const endpoint = endpointMapping[integrationType];

    const handleLoad = async () => {
        try {
            const formData = new FormData();
            formData.append('credentials', JSON.stringify(credentials));
            const response = await axios.post(`http://localhost:8000/integrations/${endpoint}/load`, formData);
            const data = response.data;
            setLoadedData(data);
        } catch (e) {
            alert(e?.response?.data?.detail);
        }
    }

    return (
        <Box display='flex' justifyContent='center' alignItems='center' flexDirection='column' width='100%'>
            <Box display='flex' flexDirection='column' width='100%'>
                <TextField
                    label="Loaded Data"
                    value={loadedData ? JSON.stringify(loadedData, null, 2) : ''}
                    sx={{mt: 2}}
                    InputLabelProps={{ shrink: true }}
                    disabled
                    multiline
                    rows={10}
                />
                <Button
                    onClick={handleLoad}
                    sx={{mt: 2}}
                    variant='contained'
                >
                    Load Data
                </Button>
                <Button
                    onClick={() => setLoadedData(null)}
                    sx={{mt: 1}}
                    variant='contained'
                >
                    Clear Data
                </Button>
            </Box>
        </Box>
    );
}

export const DataForm1 = ({ integrationType, credentials }) => {
    const [loadedData, setLoadedData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const endpoint = endpointMapping[integrationType];

    const handleLoad = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const formData = new FormData();
            formData.append('credentials', JSON.stringify(credentials));
            const response = await axios.post(
                `http://localhost:8000/integrations/${endpoint}/load`,
                formData
            );
            setLoadedData(response.data);
        } catch (e) {
            setError(e?.response?.data?.detail || 'Failed to load data');
            console.error('Error loading data:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        setLoadedData(null);
        setError(null);
    };

    const filteredData = loadedData?.filter(item => 
        JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const renderDataTable = () => {
        if (!loadedData || loadedData.length === 0) return null;

        // Get all unique keys from the first few items for column headers
        const sampleItems = loadedData.slice(0, 5);
        const columns = [...new Set(
            sampleItems.flatMap(item => Object.keys(item))
        )];

        return (
            <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table size="small" aria-label="data table">
                    <TableHead>
                        <TableRow>
                            {columns.map(col => (
                                <TableCell key={col}>{col}</TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredData.map((item, index) => (
                            <TableRow key={index}>
                                {columns.map(col => (
                                    <TableCell key={`${index}-${col}`}>
                                        {typeof item[col] === 'object' 
                                            ? JSON.stringify(item[col])
                                            : item[col]}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };

    const renderRawData = () => (
        <TextField
            label="Raw Data"
            value={loadedData ? JSON.stringify(loadedData, null, 2) : ''}
            sx={{ mt: 2, width: '100%' }}
            InputLabelProps={{ shrink: true }}
            disabled
            multiline
            rows={10}
            variant="outlined"
        />
    );

    return (
        <Box display="flex" justifyContent="center" alignItems="center" flexDirection="column" width="100%">
            <Typography variant="h6" gutterBottom>
                {integrationType} Data
            </Typography>

            <Box display="flex" gap={2} sx={{ mt: 2, width: '100%' }}>
                <Button
                    onClick={handleLoad}
                    variant="contained"
                    color="primary"
                    disabled={isLoading}
                    startIcon={isLoading ? <CircularProgress size={20} /> : null}
                >
                    {isLoading ? 'Loading...' : 'Load Data'}
                </Button>
                <Button
                    onClick={handleClear}
                    variant="outlined"
                    color="secondary"
                    disabled={!loadedData || isLoading}
                >
                    Clear Data
                </Button>
            </Box>

            {error && (
                <Typography color="error" sx={{ mt: 2 }}>
                    {error}
                </Typography>
            )}

            {loadedData && (
                <>
                    <TextField
                        label="Search"
                        variant="outlined"
                        size="small"
                        sx={{ mt: 2, width: '100%' }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    <Tabs 
                        value={activeTab} 
                        onChange={(e, newValue) => setActiveTab(newValue)}
                        sx={{ mt: 2 }}
                    >
                        <Tab label="Table View" />
                        <Tab label="Raw JSON" />
                        <Tab label="Statistics" />
                    </Tabs>

                    {activeTab === 0 && renderDataTable()}
                    {activeTab === 1 && renderRawData()}
                    {activeTab === 2 && (
                        <Box sx={{ mt: 2, width: '100%' }}>
                            <Typography variant="subtitle1">
                                Data Statistics
                            </Typography>
                            <Typography>
                                Total Items: {loadedData.length}
                            </Typography>
                            {loadedData[0] && (
                                <Typography>
                                    Sample Item Keys: {Object.keys(loadedData[0]).join(', ')}
                                </Typography>
                            )}
                        </Box>
                    )}
                </>
            )}
        </Box>
    );
};
