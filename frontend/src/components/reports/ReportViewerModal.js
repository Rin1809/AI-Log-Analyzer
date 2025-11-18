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
  Code,
  useColorModeValue,
} from '@chakra-ui/react';

const ReportViewerModal = ({ isOpen, onClose, report }) => {
  const cardBg = useColorModeValue('white', 'gray.800');

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg={cardBg}>
        <ModalHeader>{report?.name}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Code display="block" whiteSpace="pre" p={4} borderRadius="md" w="100%">
            {report?.content}
          </Code>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ReportViewerModal;