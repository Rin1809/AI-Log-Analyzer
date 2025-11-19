import React from 'react';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
  Tooltip,
  useColorModeValue,
  Text,
  Flex
} from '@chakra-ui/react';
import { ViewIcon } from '@chakra-ui/icons';

const ReportsTable = ({ reports, onViewReport }) => {
  // --- HOOKS: Must be called unconditionally at the top level ---
  const headerColor = useColorModeValue('gray.600', 'gray.400');
  const rowHoverBg = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const theadBg = useColorModeValue('gray.50', 'gray.900'); // Moved here to avoid hook error

  // Logic mapping mau sac cho Report Type
  const getTypeBadgeProps = (type) => {
    const t = type?.toLowerCase() || '';
    
    if (t.includes('periodic') || t.includes('source')) {
      return { colorScheme: 'blue', label: type }; // Source Stage
    }
    if (t.includes('final')) {
      return { colorScheme: 'red', label: type }; // Final Stage
    }
    // Cac loai khac (summary, stage_x...)
    return { colorScheme: 'orange', label: type }; 
  };

  // Logic xac dinh Status dua tren summary_stats
  const getStatusBadgeProps = (stats) => {
    if (!stats || Object.keys(stats).length === 0) {
      return { colorScheme: 'red', label: 'Error/Quota' };
    }
    
    const values = Object.values(stats);
    if (values.includes('N/A')) {
      return { colorScheme: 'red', label: 'Quota/Error' };
    }

    return { colorScheme: 'green', label: 'Success' };
  };

  // --- Early Return ---
  if (!reports || reports.length === 0) {
    return (
      <Flex justify="center" align="center" p={10} color="gray.500">
        <Text>No reports generated yet.</Text>
      </Flex>
    );
  }

  // --- Main Render ---
  return (
    <Table variant="simple" borderWidth="1px" borderColor={borderColor} borderRadius="md">
      <Thead bg={theadBg}>
        <Tr>
          <Th color={headerColor}>Hostname</Th>
          <Th color={headerColor}>Type</Th>
          <Th color={headerColor}>Time</Th>
          <Th color={headerColor}>Status</Th>
          <Th color={headerColor} isNumeric>Actions</Th>
        </Tr>
      </Thead>
      <Tbody>
        {reports.map((report) => {
          const typeProps = getTypeBadgeProps(report.type);
          const statusProps = getStatusBadgeProps(report.summary_stats);
          
          return (
            <Tr key={report.path} _hover={{ bg: rowHoverBg }} transition="background 0.2s">
              <Td fontWeight="medium">{report.hostname}</Td>
              <Td>
                <Badge 
                  colorScheme={typeProps.colorScheme} 
                  variant="subtle" 
                  borderRadius="full" 
                  px={2} 
                  fontWeight="normal"
                >
                  {typeProps.label}
                </Badge>
              </Td>
              <Td fontSize="sm" color="gray.500">
                {new Date(report.generated_time).toLocaleString()}
              </Td>
              <Td>
                 <Badge 
                  colorScheme={statusProps.colorScheme} 
                  variant="subtle"
                  borderRadius="md"
                  fontWeight="normal"
                 >
                   {statusProps.label}
                 </Badge>
              </Td>
              <Td isNumeric>
                <Tooltip label="View Details" hasArrow>
                  <IconButton
                    icon={<ViewIcon />}
                    onClick={() => onViewReport(report.path)}
                    size="sm"
                    variant="ghost"
                    colorScheme="blue"
                    aria-label="View Report"
                  />
                </Tooltip>
              </Td>
            </Tr>
          );
        })}
      </Tbody>
    </Table>
  );
};

export default ReportsTable;