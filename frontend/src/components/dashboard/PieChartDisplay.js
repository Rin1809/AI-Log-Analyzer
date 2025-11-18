import React from 'react';
import { Box, Center, Text, VStack, HStack, useColorModeValue } from '@chakra-ui/react';
import { PieChart, Pie, Cell, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#3182CE', '#805AD5', '#D69E2E', '#38A169', '#DD6B20', '#00A3C4'];

const CustomLegend = ({ payload }) => {
    const textColor = useColorModeValue('gray.600', 'gray.300');
    if (!payload || payload.length === 0) return null;
    return (
        <VStack align="start" justify="center" h="100%" spacing={3} pl={4}>
            {payload.map((entry, index) => (
                <HStack key={`item-${index}`} spacing={3}>
                    <Box boxSize="12px" borderRadius="sm" bg={entry.color} />
                    <Text fontSize="sm" color={textColor}>
                        {entry.value} ({entry.payload.payload.value})
                    </Text>
                </HStack>
            ))}
        </VStack>
    );
};

const PieChartDisplay = ({ data }) => {
    if (!data || data.length === 0) {
        return <Center h="100%"><Text color="gray.500">No data to display.</Text></Center>;
    }
    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius="80%"
                    fill="#8884d8"
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Legend
                    content={<CustomLegend />}
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                />
            </PieChart>
        </ResponsiveContainer>
    );
};

export default PieChartDisplay;