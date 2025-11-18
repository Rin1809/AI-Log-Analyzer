import React from 'react';
import { Flex, Text, useColorModeValue } from '@chakra-ui/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#0084ffff', '#7a51d3ff', '#D69E2E', '#38A169', '#DD6B20', '#ff1c1cff'];

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
                    <Line key={key} type="monotone" dataKey={key} name={`${key}`} stroke={COLORS[index % COLORS.length]} strokeWidth={2} dot={false} />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
};

export default LineChartDisplay;