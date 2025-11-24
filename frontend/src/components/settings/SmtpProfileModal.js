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
import { useLanguage } from '../../context/LanguageContext';

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
  const { t } = useLanguage();

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
    // Basic Validation
    if (!profile.profile_name || !profile.profile_name.trim()) {
       return toast({ title: t('missingInfo'), description: "Profile Name is required.", status: "warning" });
    }
    if (!profile.server || !profile.server.trim()) {
        return toast({ title: t('missingInfo'), description: "SMTP Server is required.", status: "warning" });
    }
    if (!profile.port) {
        return toast({ title: t('missingInfo'), description: "Port is required.", status: "warning" });
    }
    if (!profile.sender_email || !profile.sender_email.trim()) {
        return toast({ title: t('missingInfo'), description: "Sender Email is required.", status: "warning" });
    }

    onSave(profile);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontWeight="normal">{profileData ? t('edit') : t('add')} SMTP Profile</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <FormControl isRequired>
              <FormLabel fontSize="sm">{t('profileName')}</FormLabel>
              <Input name="profile_name" value={profile.profile_name} onChange={handleChange} isDisabled={!!profileData} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm">{t('smtpServerAddress')}</FormLabel>
              <Input name="server" value={profile.server} onChange={handleChange} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm">{t('port')}</FormLabel>
              <Input name="port" type="number" value={profile.port} onChange={handleChange} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm">{t('senderEmail')}</FormLabel>
              <Input name="sender_email" type="email" value={profile.sender_email} onChange={handleChange} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">{t('passwordAppPass')}</FormLabel>
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
            {t('cancel')}
          </Button>
          <Button  colorScheme="gray" onClick={handleSaveClick}>
            {t('save')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default SmtpProfileModal;