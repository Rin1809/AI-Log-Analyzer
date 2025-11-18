import React from 'react';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Button,
  Tag,
} from '@chakra-ui/react';

const getTagColor = (type) => {
  switch (type) {
    case 'final': return 'red';
    case 'summary': return 'orange';
    case 'periodic': return 'blue';
    default: return 'gray';
  }
};

const ReportsTable = ({ reports, onViewReport }) => {
  return (
    <TableContainer>
      <Table variant="simple" size="sm">
        <Thead>
          <Tr><Th>Hostname</Th><Th>Filename</Th><Th>Type</Th><Th>Generated Time</Th><Th>Actions</Th></Tr>
        </Thead>
        <Tbody>
          {reports.length > 0 ? (
            reports.map((report) => (
              <Tr key={report.path}>
                <Td>{report.hostname}</Td>
                <Td>{report.filename}</Td>
                <Td><Tag size="sm" colorScheme={getTagColor(report.type)}>{report.type.toUpperCase()}</Tag></Td>
                <Td>{report.generated_time}</Td>
                <Td>
                  <Button colorScheme="teal" variant="outline" size="xs" onClick={() => onViewReport(report.path)}>View</Button>
                </Td>
              </Tr>
            ))
          ) : (
            <Tr><Td colSpan={5} textAlign="center">No reports found matching your criteria.</Td></Tr>
          )}
        </Tbody>
      </Table>
    </TableContainer>
  );
};

export default ReportsTable;