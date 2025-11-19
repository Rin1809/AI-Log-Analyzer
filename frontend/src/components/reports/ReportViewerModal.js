import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Box,
  useColorModeValue,
  Code
} from '@chakra-ui/react';

const ReportViewerModal = ({ isOpen, onClose, report }) => {
  const bg = useColorModeValue("white", "gray.800");
  
  if (!report) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg={bg} height="85vh">
        <ModalHeader>
            {report.format === 'html' ? `Preview: ${report.name}` : `Raw Report: ${report.name}`}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={0}>
            {report.format === 'html' ? (
                <Box width="100%" height="100%" bg="white">
                   <iframe 
                        title="Email Preview"
                        srcDoc={report.content} 
                        style={{ width: '100%', height: '100%', border: 'none' }} 
                   />
                </Box>
            ) : (
                <Box p={4}>
                    <Code 
                        display="block" 
                        whiteSpace="pre" 
                        p={4} 
                        borderRadius="md" 
                        overflowX="auto"
                        fontSize="sm"
                    >
                        {report.content}
                    </Code>
                </Box>
            )}
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ReportViewerModal;