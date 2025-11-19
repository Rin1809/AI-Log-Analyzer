import React from 'react';
import { Flex, Text, useColorModeValue } from '@chakra-ui/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Extended palette: 20 distinct colors
const COLORS = [
    '#3182CE', // Blue
    '#805AD5', // Purple
    '#D69E2E', // Mustard
    '#38A169', // Green
    '#DD6B20', // Orange
    '#00A3C4', // Cyan
    '#D53F8C', // Pink
    '#E53E3E', // Red
    '#319795', // Teal
    '#5A67D8', // Indigo
    '#718096', // Gray
    '#F6AD55', // Light Orange
    '#68D391', // Light Green
    '#63B3ED', // Light Blue
    '#B794F4', // Light Purple
    '#F687B3', // Light Pink
    '#FC8181', // Light Red
    '#4FD1C5', // Light Teal
    '#ECC94B', // Yellow
    '#A0AEC0'  // Cool Gray
];

const LineChartDisplay = ({ data, keys }) => {
    const borderColor = useColorModeValue('gray.200', 'gray.700');
    const lineChartColor = useColorModeValue('gray.800', 'white');
    const gridStrokeColor = useColorModeValue('gray.200', 'gray.700');
    const tooltipBgColor = useColorModeValue('white', 'gray.800');

    if (!data || data.length === 0 || !keys || keys.length === 0) {
        return (
            <Flex justify="center" align="center" h="100%" pb={10}>
                <Text color="gray.500">No periodic report data available to display chart.</Text>
            </Flex>
        );
    }
    
    return (
        <ResponsiveContainer width="100%" height="90%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStrokeColor} />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: lineChartColor }} />
                <YAxis tick={{ fontSize: 12, fill: lineChartColor }} />
                <Tooltip
                    contentStyle={{
                        backgroundColor: tooltipBgColor,
                        borderColor: borderColor
                    }}
                />
                <Legend />
                {keys.map((key, index) => (
                    <Line 
                        key={key} 
                        type="monotone" 
                        dataKey={key} 
                        name={`${key}`} 
                        stroke={COLORS[index % COLORS.length]} 
                        strokeWidth={2} 
                        dot={false} 
                    />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
};

export default LineChartDisplay;