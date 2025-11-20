import React, { useState, useEffect } from 'react';
import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  VStack,
  useToast,
  InputGroup,
  InputRightElement,
  IconButton
} from '@chakra-ui/react';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';

const SmtpProfileModal = ({ isOpen, onClose, onSave, profileData }) => {
  const [profile, setProfile] = useState({
    profile_name: '',
    server: '',
    port: 587,
    sender_email: '',
    sender_password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (profileData) {
      setProfile(profileData);
    } else {
      setProfile({
        profile_name: '',
        server: '',
        port: 587,
        sender_email: '',
        sender_password: ''
      });
    }
  }, [profileData, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveClick = () => {
    // // basic validation
    if (!profile.profile_name || !profile.server || !profile.port || !profile.sender_email) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    onSave(profile);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontWeight="normal">{profileData ? 'Edit' : 'Add New'} SMTP Profile</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Profile Name</FormLabel>
              <Input name="profile_name" value={profile.profile_name} onChange={handleChange} isDisabled={!!profileData} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm">SMTP Server</FormLabel>
              <Input name="server" value={profile.server} onChange={handleChange} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Port</FormLabel>
              <Input name="port" type="number" value={profile.port} onChange={handleChange} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Sender Email</FormLabel>
              <Input name="sender_email" type="email" value={profile.sender_email} onChange={handleChange} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Password / App Password</FormLabel>
              <InputGroup>
                <Input
                  name="sender_password"
                  type={showPassword ? 'text' : 'password'}
                  value={profile.sender_password}
                  onChange={handleChange}
                />
                <InputRightElement>
                  <IconButton
                    h="1.75rem"
                    size="sm"
                    onClick={() => setShowPassword(!showPassword)}
                    icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                    variant="ghost"
                  />
                </InputRightElement>
              </InputGroup>
            </FormControl>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button  colorScheme="gray" onClick={handleSaveClick}>
            Save Profile
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default SmtpProfileModal;