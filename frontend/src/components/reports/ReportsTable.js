import React from 'react';
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Text,
  Box,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton
} from '@chakra-ui/react';
import { ViewIcon, EmailIcon, DownloadIcon, DeleteIcon } from '@chakra-ui/icons';

// Custom Icon cho Menu (3 chấm dọc)
const ThreeDotsIcon = (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
    </svg>
);

const ReportsTable = ({ reports, onViewRaw, onViewTemplate, onDownload, onDelete }) => {
  
  // Logic hien thi status: chi dung text mau, khong dung Badge
  const getStatusContent = (stats) => {
    const isError = !stats || Object.keys(stats).length === 0 || Object.values(stats).includes('N/A');
    return isError ? (
      <Text color="orange.500" fontWeight="medium">Failed</Text>
    ) : (
      <Text color="green.500" fontWeight="medium">Success</Text>
    );
  };

  return (
    <Box overflowX="auto">
      <Table variant="simple">
        <Thead>
          <Tr>
            <Th>Hostname</Th>
            <Th>Type</Th>
            <Th>Time</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {reports.length > 0 ? (
            reports.map((report) => (
              <Tr key={report.path}>
                <Td fontWeight="medium">{report.hostname}</Td>
                <Td textTransform="capitalize">
                    {report.type.replace(/_/g, ' ')}
                </Td>
                <Td fontSize="sm" color="gray.500">
                   {new Date(report.generated_time).toLocaleString()}
                </Td>
                <Td>
                    {getStatusContent(report.summary_stats)}
                </Td>
                <Td>
                  <Menu>
                    <MenuButton
                        as={IconButton}
                        icon={<ThreeDotsIcon style={{ width: '20px', height: '20px' }} />}
                        variant="ghost"
                        size="sm"
                        aria-label="Report Actions"
                    />
                    <MenuList>
                        <MenuItem icon={<ViewIcon />} onClick={() => onViewRaw(report.path)}>
                            View Raw (JSON)
                        </MenuItem>
                        <MenuItem icon={<EmailIcon />} onClick={() => onViewTemplate(report.path)}>
                            View Template (Preview)
                        </MenuItem>
                        <MenuItem icon={<DownloadIcon />} onClick={() => onDownload(report.path)}>
                            Download
                        </MenuItem>
                        <MenuItem icon={<DeleteIcon />} color="red.500" onClick={() => onDelete(report.path)}>
                            Delete Report
                        </MenuItem>
                    </MenuList>
                  </Menu>
                </Td>
              </Tr>
            ))
          ) : (
            <Tr>
              <Td colSpan={5} textAlign="center" color="gray.500" py={4}>
                No reports found.
              </Td>
            </Tr>
          )}
        </Tbody>
      </Table>
    </Box>
  );
};

export default ReportsTable;