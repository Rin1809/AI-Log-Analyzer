import React from 'react';
import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Textarea,
  useColorModeValue
} from '@chakra-ui/react';

const ConfigEditorModal = ({ isOpen, onClose, selectedConfig, setSelectedConfig, onSave }) => {
  const cardBg = useColorModeValue('white', 'gray.800');

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg={cardBg}>
        <ModalHeader>Edit Config: {selectedConfig.id}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Textarea
            value={selectedConfig.content}
            onChange={(e) => setSelectedConfig({ ...selectedConfig, content: e.target.value })}
            fontFamily="monospace"
            height="60vh"
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button colorScheme="blue" onClick={onSave}>Save Changes</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default ConfigEditorModal;